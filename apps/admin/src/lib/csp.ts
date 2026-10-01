/**
 * The admin's script Content-Security-Policy (nonce + `strict-dynamic`), the same shape as
 * the storefront's (`apps/storefront/src/lib/csp.ts`). `proxy.ts` mints a nonce per request,
 * sends this header on the response and forwards it (plus `x-nonce`) on the request, where
 * Next reads it and puts the nonce on its own scripts; the root layout hands `x-nonce` to
 * next-themes for its no-flash script.
 *
 * `https:` and `'unsafe-inline'` are only fallbacks for browsers without CSP 3: a browser
 * that understands nonces and `strict-dynamic` ignores both. Development adds
 * `'unsafe-eval'` (React's dev error stacks) and only reports, so the dev overlay and HMR
 * keep working; production enforces. `frame-ancestors 'self'` repeats `next.config.ts`.
 */

export const NONCE_HEADER = 'x-nonce'

export const ADMIN_FRAME_ANCESTORS = "frame-ancestors 'self'"

export type CspHeader = {
  name: 'Content-Security-Policy' | 'Content-Security-Policy-Report-Only'
  value: string
}

/** 128 random bits, base64. Web Crypto, so it works in any runtime the proxy runs in. */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}

export function scriptCsp(input: { nonce: string; dev: boolean }): CspHeader {
  const script = [
    "'self'",
    `'nonce-${input.nonce}'`,
    "'strict-dynamic'",
    'https:',
    "'unsafe-inline'",
    ...(input.dev ? ["'unsafe-eval'"] : []),
  ].join(' ')
  // worker-src is spelled out: without it workers fall back to script-src, where
  // 'strict-dynamic' would refuse even same-origin worker scripts.
  const directives = [
    `script-src ${script}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
  ]
  // Report-only ignores frame-ancestors; next.config.ts enforces it in development.
  if (!input.dev) directives.push(ADMIN_FRAME_ANCESTORS)
  return {
    name: input.dev ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
    value: directives.join('; '),
  }
}

/** The forwarded request headers carry the nonce and the policy (Next reads it there). */
export function forwardNonce(headers: Headers, nonce: string, csp: CspHeader): void {
  // Next takes the nonce from whichever policy header the request carries; only ours counts.
  headers.delete('content-security-policy')
  headers.delete('content-security-policy-report-only')
  headers.set(NONCE_HEADER, nonce)
  headers.set(csp.name, csp.value)
}
