'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { resetPasswordAction, type ActionResult } from '@/actions/auth'
import type { Dictionary } from '@/lib/dictionaries'

interface ResetFormProps {
  t: Dictionary['auth']['resetPassword']
  token: string
  locale: string
}

const initialState: ActionResult = { success: false }

export function ResetForm({ t, token, locale }: ResetFormProps) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, initialState)

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
          {t.successLink}
        </Link>
      </div>
    )
  }

  // Show error if token is invalid/missing before the form
  if (state.error === 'tokenInvalid' || state.error === 'tokenRequired') {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <p className="text-destructive text-sm">{errorMsg}</p>
        <Link
          href={`/${locale}/auth/forgot-password`}
          className="text-primary text-sm font-medium hover:underline"
        >
          ← Request a new link
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {/* Hidden token field */}
      <input type="hidden" name="token" value={token} />

      {state.error && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {errorMsg}
        </p>
      )}

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

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isPending}>
        {isPending ? t.submitting : t.submitButton}
      </Button>
    </form>
  )
}
