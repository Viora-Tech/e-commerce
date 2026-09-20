import { resolveStore } from '@commerce/db'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from './lib/db'
import { DERIVED_HEADERS, routeForStore } from './lib/routing'
import { createStoreResolver, hostnameFromHeader } from './lib/store-resolver'

const resolve = createStoreResolver({ lookup: (hostname) => resolveStore(db(), hostname) })

/** Cloudflare's edge country, forwarded for region defaults. Absent when not behind Cloudflare. */
function visitorCountry(request: NextRequest): string | null {
  const c = request.headers.get('cf-ipcountry')?.trim().toUpperCase()
  return c && /^[A-Z]{2}$/.test(c) ? c : null
}

export async function proxy(request: NextRequest) {
  const hostname = hostnameFromHeader(request.headers.get('host'))
  const storeId = hostname ? await resolve(hostname) : null
  if (!storeId) {
    return new NextResponse(`No store is configured for ${hostname ?? 'this host'}.`, {
      status: 404,
      headers: { 'content-type': 'text/plain' },
    })
  }

  const route = routeForStore(storeId, request.nextUrl.pathname)
  if (route.kind === 'forbidden') return new NextResponse('Not found', { status: 404 })

  // Never trust routing headers from the client; set only what the proxy derived.
  const headers = new Headers(request.headers)
  for (const h of DERIVED_HEADERS) headers.delete(h)
  headers.set('x-store-id', storeId)
  const country = visitorCountry(request)
  if (country) headers.set('x-visitor-country', country)

  if (route.kind === 'passthrough') return NextResponse.next({ request: { headers } })

  const url = request.nextUrl.clone()
  url.pathname = route.path
  return NextResponse.rewrite(url, { request: { headers } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
