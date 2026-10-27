import { NextResponse } from 'next/server'

/**
 * A redirect to a path on the shopper's own host. Route handlers must not build the target from
 * `request.url`: behind the proxy's rewrite it carries the server's bind address
 * (`https://0.0.0.0:3100`), not the store's domain. A relative `Location` keeps whatever host the
 * shopper is on (subdomain, custom domain or checkout origin). Cookies can still be set on it.
 */
export function redirectTo(path: string, status: 303 | 307 = 307): NextResponse {
  return new NextResponse(null, { status, headers: { location: path } })
}
