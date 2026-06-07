'use client'

import { useState, useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { resendVerificationAction, type ActionResult } from '@/actions/auth'
import type { Dictionary } from '@/lib/dictionaries'

interface VerifyClientProps {
  t: Dictionary['auth']['verifyEmail']
  token: string
  email: string
  locale: string
  initialResult: ActionResult
}

const resendInitial: ActionResult = { success: false }

export function VerifyClient({
  t,
  token: _token,
  email,
  locale,
  initialResult,
}: VerifyClientProps) {
  const [result] = useState<ActionResult | null>(initialResult)
  const loading = false

  const [resendState, resendAction, resendPending] = useActionState(
    resendVerificationAction,
    resendInitial
  )

  const displayResult = result ?? initialResult
  const errorKey = displayResult.error as keyof typeof t.errors | undefined
  const errorMsg = errorKey && t.errors[errorKey] ? t.errors[errorKey] : displayResult.error

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-4 w-48" />
        <p className="text-muted-foreground text-sm">{t.checking}</p>
      </div>
    )
  }

  if (displayResult.success) {
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

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <div className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full text-2xl">
        ✕
      </div>

      {displayResult.error && <p className="text-destructive text-sm">{errorMsg}</p>}

      {/* Resend form */}
      {displayResult.error !== 'alreadyVerified' && (
        <form action={resendAction} className="flex w-full flex-col gap-3">
          <input type="hidden" name="email" value={email} />
          {resendState.success && (
            <p className="text-sm text-[#2E7D5B]">Verification email sent.</p>
          )}
          <Button
            type="submit"
            variant="secondary"
            className="w-full"
            disabled={resendPending || resendState.success}
          >
            {resendPending ? t.resending : t.resendButton}
          </Button>
        </form>
      )}

      <Link
        href={`/${locale}/auth/login`}
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← {t.backToLogin}
      </Link>
    </div>
  )
}
