import { wahooProvider } from '@/services/wahoo'

export async function GET(request: Request): Promise<Response> {
  return wahooProvider.handleCallback(request)
}
