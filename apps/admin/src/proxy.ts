import { type NextRequest, NextResponse } from 'next/server'
import {
  forwardNonce,
  newNonce,
  PAGE_CACHE_CONTROL,
  REQUEST_PATH_HEADER,
  scriptCsp,
} from './lib/csp'

/**
 * The admin's proxy: the script Content-Security-Policy with a fresh nonce per request
 * (`lib/csp.ts`), on the page response and on the forwarded request (Next reads the nonce
 * there for its own scripts; the root layout reads `x-nonce`), and a `no-transform`
 * Cache-Control so Cloudflare serves the page HTML exactly as React rendered it.
 */
export function proxy(request: NextRequest) {
  const nonce = newNonce()
  const csp = scriptCsp({ nonce, dev: process.env.NODE_ENV !== 'production' })
  const headers = new Headers(request.headers)
  forwardNonce(headers, nonce, csp)
  // The page asked for, so the admin layout can send a signed-out visitor back to it after login.
  headers.set(REQUEST_PATH_HEADER, request.nextUrl.pathname + request.nextUrl.search)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set(csp.name, csp.value)
  // Cloudflare must not rewrite emails in the HTML (React #418 on every page, `lib/csp.ts`).
  response.headers.set('Cache-Control', PAGE_CACHE_CONTROL)
  return response
}

export const config = {
  // Pages only. Not `/api/*` (JSON, auth, webhooks, health checks) and not `/uploads/*`, which
  // serves stored files under its own `default-src 'none'; sandbox` policy.
  matcher: [
    {
      source: '/((?!api/|uploads/|_next/static|_next/image|favicon.ico|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
