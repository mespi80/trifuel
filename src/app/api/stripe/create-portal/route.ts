import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createBillingPortalSession } from '@/actions/subscription'

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { lang: string }
  const result = await createBillingPortalSession(body.lang ?? 'en')

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ url: result.url })
}
