import { corosProvider } from '@/services/coros'

export async function GET(request: Request): Promise<Response> {
  return corosProvider.handleCallback(request)
}
