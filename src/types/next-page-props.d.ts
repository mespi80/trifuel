/**
 * Fallback global types for Next.js page/layout props.
 *
 * Next.js generates `PageProps<R>` and `LayoutProps<R>` into `.next/types/`
 * during `next dev` / `next build`. Until that runs, `tsc --noEmit` would
 * fail on files that use those generated types. This file provides simple
 * stand-alone definitions that are always available.
 *
 * The generated versions are more precise (they enforce route-specific
 * searchParams shapes), but these are compatible with all actual usage in
 * this codebase (params and searchParams are always Promises of plain objects).
 */

// All locale routes have `{ lang: string }` in params.
// Extra dynamic segments (e.g. [sessionId]) are included via the index signature.
// The explicit `lang: string` property prevents `noUncheckedIndexedAccess`
// from widening it to `string | undefined`.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare type PageProps<_Route extends string = string> = {
  params: Promise<{ lang: string; [key: string]: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

import type { ReactNode } from 'react'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare type LayoutProps<_Route extends string = string> = {
  children: ReactNode
  params: Promise<{ lang: string; [key: string]: string }>
}
