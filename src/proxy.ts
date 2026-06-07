import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { defaultLocale, isValidLocale } from '@/lib/dictionaries'

// NOTE: proxy.ts runs in the Edge Runtime.
// ioredis is Node.js-only, so rate limiting here uses the built-in
// Response count via sliding-window headers from a separate API route,
// or is skipped in the Edge layer.  Full rate limiting is enforced in
// the Node.js Server Action layer (src/actions/auth.ts).

const AUTH_ROUTES = [
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
]
const PROTECTED_ROUTES = ['/dashboard', '/training', '/nutrition', '/profile', '/settings']

/**
 * Detect the preferred locale from the Accept-Language header.
 * Falls back to defaultLocale.
 */
function getLocale(request: NextRequest): string {
  const acceptLang = request.headers.get('accept-language') ?? ''
  for (const part of acceptLang.split(',')) {
    const lang = part.trim().split(';')[0]?.split('-')[0]?.toLowerCase()
    if (lang && isValidLocale(lang)) return lang
  }
  return defaultLocale
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 1. Pass through Next.js internals and static assets ──────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // static files (favicon, etc.)
  ) {
    return NextResponse.next()
  }

  // ── 2. Locale detection & redirect ───────────────────────────────────────
  // Check if the pathname already starts with a valid locale segment
  const segments = pathname.split('/')
  const maybeLocale = segments[1] ?? ''

  if (!isValidLocale(maybeLocale)) {
    // No locale prefix → detect and redirect
    const locale = getLocale(request)
    const newUrl = request.nextUrl.clone()
    newUrl.pathname = `/${locale}${pathname}`
    return NextResponse.redirect(newUrl)
  }

  const locale = maybeLocale
  // The path after the locale prefix, e.g. "/auth/login"
  const pathWithoutLocale = `/${segments.slice(2).join('/')}`

  // ── 3. Auth session check (Edge-compatible via cookie) ────────────────────
  // next-auth v5 sets an "authjs.session-token" or "__Secure-authjs.session-token" cookie.
  const sessionCookie =
    request.cookies.get('authjs.session-token') ??
    request.cookies.get('__Secure-authjs.session-token')

  const isAuthenticated = Boolean(sessionCookie?.value)
  const isAuthRoute = AUTH_ROUTES.some((r) => pathWithoutLocale.startsWith(r))
  const isProtectedRoute = PROTECTED_ROUTES.some((r) => pathWithoutLocale.startsWith(r))

  // Redirect authenticated users away from auth pages (except verify-email)
  if (isAuthenticated && isAuthRoute && !pathWithoutLocale.startsWith('/auth/verify-email')) {
    const newUrl = request.nextUrl.clone()
    newUrl.pathname = `/${locale}/dashboard`
    return NextResponse.redirect(newUrl)
  }

  // Redirect unauthenticated users away from protected routes
  if (!isAuthenticated && isProtectedRoute) {
    const newUrl = request.nextUrl.clone()
    newUrl.pathname = `/${locale}/auth/login`
    newUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(newUrl)
  }

  // ── 4. Set locale header so server components can read it ─────────────────
  const response = NextResponse.next()
  response.headers.set('x-locale', locale)
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
