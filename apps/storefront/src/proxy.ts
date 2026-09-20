import { resolveStore } from '@commerce/db'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from './lib/db'
import { STORE_HEADER } from './lib/store-context'
import { createStoreResolver, hostnameFromHeader } from './lib/store-resolver'

const resolve = createStoreResolver({ lookup: (hostname) => resolveStore(db(), hostname) })

export async function proxy(request: NextRequest) {
  const hostname = hostnameFromHeader(request.headers.get('host'))
  const storeId = hostname ? await resolve(hostname) : null
  if (!storeId) {
    return new NextResponse(`No store is configured for ${hostname ?? 'this host'}.`, {
      status: 404,
      headers: { 'content-type': 'text/plain' },
    })
  }
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(STORE_HEADER, storeId)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
