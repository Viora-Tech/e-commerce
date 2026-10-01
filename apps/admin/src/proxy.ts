import { type NextRequest, NextResponse } from 'next/server'
import { forwardNonce, newNonce, scriptCsp } from './lib/csp'

/**
 * The admin's only proxy job: the script Content-Security-Policy with a fresh nonce per
 * request (`lib/csp.ts`), on the page response and on the forwarded request (Next reads the
 * nonce there for its own scripts; the root layout reads `x-nonce`).
 */
export function proxy(request: NextRequest) {
  const nonce = newNonce()
  const csp = scriptCsp({ nonce, dev: process.env.NODE_ENV !== 'production' })
  const headers = new Headers(request.headers)
  forwardNonce(headers, nonce, csp)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set(csp.name, csp.value)
  return response
}

export const config = {
  // Pages only. Not `/api/*` (JSON, auth, webhooks, health checks) and not `/uploads/*`, which
  // serves stored files under its own `default-src 'none'; sandbox` policy.
  matcher: [
    {
      source: '/((?!api/|uploads/|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
