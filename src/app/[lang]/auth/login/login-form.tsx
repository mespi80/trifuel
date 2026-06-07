'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OAuthButtons } from '@/components/auth/oauth-buttons'
import { loginAction, type ActionResult } from '@/actions/auth'
import type { Dictionary } from '@/lib/dictionaries'

interface LoginFormProps {
  t: Dictionary['auth']['login']
  locale: string
}

const initialState: ActionResult = { success: false }

export function LoginForm({ t, locale }: LoginFormProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(loginAction, initialState)

  useEffect(() => {
    if (state.success) {
      router.push(`/${locale}/dashboard`)
      router.refresh()
    }
  }, [state.success, locale, router])

  const errorKey = state.error as keyof typeof t.errors | undefined
  const errorMsg = errorKey && t.errors[errorKey] ? t.errors[errorKey] : state.error

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {/* Global error */}
      {state.error && !state.field && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {errorMsg}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-foreground text-sm font-medium">
          {t.emailLabel}
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder={t.emailPlaceholder}
          autoComplete="email"
          required
          disabled={isPending}
          error={state.field === 'email'}
          aria-describedby={state.field === 'email' ? 'email-error' : undefined}
        />
        {state.field === 'email' && (
          <p id="email-error" className="text-destructive text-xs">
            {errorMsg}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-foreground text-sm font-medium">
            {t.passwordLabel}
          </label>
          <Link
            href={`/${locale}/auth/forgot-password`}
            className="text-primary text-xs hover:underline"
          >
            {t.forgotPassword}
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder={t.passwordPlaceholder}
          autoComplete="current-password"
          required
          disabled={isPending}
          error={state.field === 'password'}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="mt-1 w-full"
        disabled={isPending}
      >
        {isPending ? t.submitting : t.submitButton}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        {t.noAccount}{' '}
        <Link href={`/${locale}/auth/signup`} className="text-primary font-medium hover:underline">
          {t.signupLink}
        </Link>
      </p>

      <OAuthButtons
        googleLabel={t.google}
        appleLabel={t.apple}
        orLabel={t.orContinueWith}
        locale={locale}
      />
    </form>
  )
}
