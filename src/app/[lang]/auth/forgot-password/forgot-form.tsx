'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { forgotPasswordAction, type ActionResult } from '@/actions/auth'
import type { Dictionary } from '@/lib/dictionaries'

interface ForgotFormProps {
  t: Dictionary['auth']['forgotPassword']
  locale: string
}

const initialState: ActionResult = { success: false }

export function ForgotForm({ t, locale }: ForgotFormProps) {
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, initialState)

  const errorKey = state.error as keyof typeof t.errors | undefined
  const errorMsg = errorKey && t.errors[errorKey] ? t.errors[errorKey] : state.error

  if (state.success) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-[#E8F5EE] text-2xl text-[#2E7D5B]">
          ✉
        </div>
        <p className="text-muted-foreground text-sm">{t.success}</p>
        <Link
          href={`/${locale}/auth/login`}
          className="text-primary text-sm font-medium hover:underline"
        >
          {t.backToLogin}
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && (
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
          error={Boolean(state.error)}
        />
      </div>

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isPending}>
        {isPending ? t.submitting : t.submitButton}
      </Button>

      <Link
        href={`/${locale}/auth/login`}
        className="text-muted-foreground hover:text-foreground text-center text-sm"
      >
        ← {t.backToLogin}
      </Link>
    </form>
  )
}
