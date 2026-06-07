import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { wahooProvider } from '@/services/wahoo'

export async function GET(request: Request): Promise<Response> {
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  return wahooProvider.authorize(userId, request)
}
