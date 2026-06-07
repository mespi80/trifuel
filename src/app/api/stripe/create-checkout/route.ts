import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createCheckoutSession } from '@/actions/subscription'

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { priceId: string; lang: string }

  if (!body.priceId) {
    return NextResponse.json({ error: 'priceId is required' }, { status: 400 })
  }

  const result = await createCheckoutSession(body.priceId, body.lang ?? 'en')

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ url: result.url })
}
