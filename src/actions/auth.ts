'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { signIn, signOut as nextAuthSignOut } from '@/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { redis } from '@/lib/redis'
import { authRateLimit } from '@/lib/rate-limit'

// ── Shared helpers ────────────────────────────────────────────────────────────

function getClientIp(): string {
  // headers() is async in Next.js 16 but synchronous call still works via the
  // request context.  We cast the return since we're in a Server Action.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hdrs = headers() as any
  return (
    hdrs.get?.('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get?.('x-real-ip') ?? '127.0.0.1'
  )
}

// ── Schema definitions ────────────────────────────────────────────────────────

const signUpSchema = z
  .object({
    name: z.string().min(1, 'nameRequired').max(100),
    email: z.string().email('emailInvalid'),
    password: z.string().min(8, 'passwordTooShort'),
    confirmPassword: z.string().min(1, 'passwordRequired'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'passwordsDoNotMatch',
    path: ['confirmPassword'],
  })

const loginSchema = z.object({
  email: z.string().email('emailInvalid'),
  password: z.string().min(1, 'passwordRequired'),
})

const forgotPasswordSchema = z.object({
  email: z.string().email('emailInvalid'),
})

const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'tokenRequired'),
    password: z.string().min(8, 'passwordTooShort'),
    confirmPassword: z.string().min(1, 'passwordRequired'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'passwordsDoNotMatch',
    path: ['confirmPassword'],
  })

// ── Result type ───────────────────────────────────────────────────────────────

export interface ActionResult {
  success: boolean
  error?: string
  field?: string
}

// ── Sign up ───────────────────────────────────────────────────────────────────

export async function signUpAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ip = getClientIp()
  const rl = await authRateLimit.signup(ip)
  if (!rl.success) return { success: false, error: 'tooManyAttempts' }

  const parsed = signUpSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { success: false, error: first?.message, field: first?.path[0]?.toString() }
  }

  const { name, email, password } = parsed.data
  const normalizedEmail = email.toLowerCase()

  // Check if email already taken
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1)

  if (existing) return { success: false, error: 'emailTaken', field: 'email' }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12)

  // Create user
  const [user] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      name,
      passwordHash,
      provider: 'email',
      emailVerified: false,
    })
    .returning({ id: users.id, email: users.email })

  if (!user) return { success: false, error: 'error' }

  // Create and store email verification token in Redis (24h TTL)
  const verifyToken = crypto.randomUUID()
  await redis.setex(`auth:verify:${verifyToken}`, 24 * 60 * 60, user.id).catch(() => null)

  // TODO: send verification email with verifyToken
  // await sendVerificationEmail(user.email, verifyToken, locale)

  return { success: true }
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ip = getClientIp()
  const rl = await authRateLimit.login(ip)
  if (!rl.success) return { success: false, error: 'tooManyAttempts' }

  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { success: false, error: first?.message, field: first?.path[0]?.toString() }
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      redirect: false,
    })
    return { success: true }
  } catch {
    return { success: false, error: 'invalidCredentials' }
  }
}

// ── Sign out ──────────────────────────────────────────────────────────────────

export async function signOutAction(locale = 'en'): Promise<void> {
  await nextAuthSignOut({ redirect: false })
  redirect(`/${locale}/auth/login`)
}

// ── Forgot password ───────────────────────────────────────────────────────────

export async function forgotPasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') })

  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { success: false, error: first?.message, field: 'email' }
  }

  const email = parsed.data.email.toLowerCase()

  // Rate limit per email to prevent enumeration
  const rl = await authRateLimit.forgotPassword(email)
  if (!rl.success) return { success: false, error: 'tooManyAttempts' }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  // Always return success to prevent email enumeration
  if (!user) return { success: true }

  // Store reset token in Redis (1 hour TTL)
  const resetToken = crypto.randomUUID()
  await redis.setex(`auth:reset:${resetToken}`, 60 * 60, user.id).catch(() => null)

  // TODO: send password reset email
  // await sendPasswordResetEmail(email, resetToken, locale)

  return { success: true }
}

// ── Reset password ────────────────────────────────────────────────────────────

export async function resetPasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { success: false, error: first?.message, field: first?.path[0]?.toString() }
  }

  const { token, password } = parsed.data

  // Look up token in Redis
  const userId = await redis.get(`auth:reset:${token}`).catch(() => null)
  if (!userId) return { success: false, error: 'tokenInvalid' }

  // Update password
  const passwordHash = await bcrypt.hash(password, 12)
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId))

  // Invalidate the token
  await redis.del(`auth:reset:${token}`).catch(() => null)

  return { success: true }
}

// ── Verify email ──────────────────────────────────────────────────────────────

export async function verifyEmailAction(token: string): Promise<ActionResult> {
  if (!token) return { success: false, error: 'tokenRequired' }

  const rl = await authRateLimit.verifyEmail(token)
  if (!rl.success) return { success: false, error: 'tooManyAttempts' }

  const userId = await redis.get(`auth:verify:${token}`).catch(() => null)
  if (!userId) return { success: false, error: 'tokenInvalid' }

  // Check if already verified
  const [user] = await db
    .select({ emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (user?.emailVerified) return { success: false, error: 'alreadyVerified' }

  // Mark as verified
  await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, userId))

  // Invalidate the token
  await redis.del(`auth:verify:${token}`).catch(() => null)

  return { success: true }
}

// ── Resend verification email ─────────────────────────────────────────────────

export async function resendVerificationAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const email = formData.get('email')?.toString().toLowerCase()
  if (!email) return { success: false, error: 'emailRequired' }

  const ip = getClientIp()
  const rl = await authRateLimit.forgotPassword(email + ip)
  if (!rl.success) return { success: false, error: 'tooManyAttempts' }

  const [user] = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (!user || user.emailVerified) return { success: true } // silent

  const verifyToken = crypto.randomUUID()
  await redis.setex(`auth:verify:${verifyToken}`, 24 * 60 * 60, user.id).catch(() => null)

  // TODO: send verification email
  // await sendVerificationEmail(email, verifyToken, locale)

  return { success: true }
}
