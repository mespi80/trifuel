'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OAuthButtons } from '@/components/auth/oauth-buttons'
import { signUpAction, type ActionResult } from '@/actions/auth'
import type { Dictionary } from '@/lib/dictionaries'

interface SignUpFormProps {
  t: Dictionary['auth']['signup']
  locale: string
}

const initialState: ActionResult = { success: false }

export function SignUpForm({ t, locale }: SignUpFormProps) {
  const [state, formAction, isPending] = useActionState(signUpAction, initialState)

  const errorKey = state.error as keyof typeof t.errors | undefined
  const errorMsg = errorKey && t.errors[errorKey] ? t.errors[errorKey] : state.error

  if (state.success) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-[#E8F5EE] text-2xl text-[#2E7D5B]">
          ✓
        </div>
        <p className="text-muted-foreground text-sm">{t.success}</p>
        <Link
          href={`/${locale}/auth/login`}
          className="text-primary text-sm font-medium hover:underline"
        >
          {t.loginLink}
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && !state.field && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {errorMsg}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-foreground text-sm font-medium">
          {t.nameLabel}
        </label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder={t.namePlaceholder}
          autoComplete="name"
          required
          disabled={isPending}
          error={state.field === 'name'}
        />
        {state.field === 'name' && <p className="text-destructive text-xs">{errorMsg}</p>}
      </div>

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
        />
        {state.field === 'email' && <p className="text-destructive text-xs">{errorMsg}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-foreground text-sm font-medium">
          {t.passwordLabel}
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder={t.passwordPlaceholder}
          autoComplete="new-password"
          required
          disabled={isPending}
          error={state.field === 'password'}
        />
        {state.field === 'password' && <p className="text-destructive text-xs">{errorMsg}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmPassword" className="text-foreground text-sm font-medium">
          {t.confirmPasswordLabel}
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder={t.confirmPasswordPlaceholder}
          autoComplete="new-password"
          required
          disabled={isPending}
          error={state.field === 'confirmPassword'}
        />
        {state.field === 'confirmPassword' && (
          <p className="text-destructive text-xs">{errorMsg}</p>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        {t.terms}{' '}
        <Link href={`/${locale}/terms`} className="text-primary hover:underline">
          {t.termsLink}
        </Link>{' '}
        {t.and}{' '}
        <Link href={`/${locale}/privacy`} className="text-primary hover:underline">
          {t.privacyLink}
        </Link>
        .
      </p>

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isPending}>
        {isPending ? t.submitting : t.submitButton}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        {t.hasAccount}{' '}
        <Link href={`/${locale}/auth/login`} className="text-primary font-medium hover:underline">
          {t.loginLink}
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
