import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { corosProvider } from '@/services/coros'

export async function GET(request: Request): Promise<Response> {
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  return corosProvider.authorize(userId, request)
}
