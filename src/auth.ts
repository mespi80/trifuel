import NextAuth from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import Apple from 'next-auth/providers/apple'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { users } from '@/db/schema'
import { redis } from '@/lib/redis'

// ── Constants ─────────────────────────────────────────────────────────────────
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

// ── Credential schema ─────────────────────────────────────────────────────────
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// ── NextAuth config ───────────────────────────────────────────────────────────
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt', maxAge: SESSION_TTL_SECONDS },

  // ── JWT: store session data in Redis, put only sessionId in the cookie ─────
  jwt: {
    encode: async (params) => {
      const { encode: jwtEncode } = await import('@auth/core/jwt')
      const { token, secret, maxAge, salt } = params

      if (token?.sub) {
        const sessionId = (token.sessionId as string | undefined) ?? crypto.randomUUID()
        token.sessionId = sessionId

        await redis
          .setex(`auth:session:${sessionId}`, maxAge ?? SESSION_TTL_SECONDS, JSON.stringify(token))
          .catch(() => null) // fail open — Redis unavailable degrades gracefully
      }

      return jwtEncode({ token, secret, maxAge, salt })
    },

    decode: async (params) => {
      const { decode: jwtDecode } = await import('@auth/core/jwt')
      const { token, secret, salt } = params

      const payload = await jwtDecode({ token, secret, salt })
      if (!payload) return null

      const sessionId = payload.sessionId as string | undefined
      if (!sessionId) return payload

      try {
        const raw = await redis.get(`auth:session:${sessionId}`)
        if (!raw) return null // session has been revoked
        return JSON.parse(raw) as JWT
      } catch {
        return payload // Redis unavailable → fall back to cookie data
      }
    },
  },

  // ── Providers ─────────────────────────────────────────────────────────────
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1)

        if (!user?.passwordHash) return null

        const passwordMatch = await bcrypt.compare(password, user.passwordHash)
        if (!passwordMatch) return null

        return { id: user.id, email: user.email, name: user.name, image: user.imageUrl }
      },
    }),

    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    Apple({
      clientId: process.env.APPLE_ID!,
      clientSecret: process.env.APPLE_SECRET!,
    }),
  ],

  // ── Callbacks ─────────────────────────────────────────────────────────────
  callbacks: {
    jwt: async ({ token, user, account }) => {
      if (user) {
        token.id = user.id
        if (account && account.provider !== 'credentials') {
          await upsertOAuthUser({
            token: token as Record<string, unknown>,
            user,
            provider: account.provider,
          })
        }
      }
      return token
    },

    session: async ({ session, token }) => {
      if (token.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session.user as any).id = token.id as string
      }
      return session
    },
  },

  // ── Events ────────────────────────────────────────────────────────────────
  events: {
    signOut: async (message) => {
      // 'token' is only present in JWT strategy sign-outs
      const token = 'token' in message ? (message.token as Record<string, unknown> | null) : null
      const sessionId = token?.sessionId as string | undefined
      if (sessionId) {
        await redis.del(`auth:session:${sessionId}`).catch(() => null)
      }
    },
  },

  // ── Pages ─────────────────────────────────────────────────────────────────
  pages: {
    signIn: '/en/auth/login',
    error: '/en/auth/login',
  },
})

// ── OAuth user upsert ─────────────────────────────────────────────────────────
async function upsertOAuthUser({
  token,
  user,
  provider,
}: {
  token: Record<string, unknown>
  user: { id?: string; email?: string | null; name?: string | null; image?: string | null }
  provider: string
}) {
  if (!user.email) return

  const email = user.email.toLowerCase()

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existing) {
    token.id = existing.id
    return
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      name: user.name ?? null,
      imageUrl: user.image ?? null,
      provider: provider === 'google' ? 'google' : provider === 'apple' ? 'apple' : 'email',
      emailVerified: true,
    })
    .returning({ id: users.id })

  if (created) token.id = created.id
}
