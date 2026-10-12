import 'server-only'
import { headers } from 'next/headers'
import { userAgent } from 'next/server'
import { cache } from 'react'

/** `Sec-Fetch-Dest` values of a request whose answer the browser renders as a page. */
const DOCUMENT_DESTINATIONS = new Set(['document', 'iframe', 'frame', 'embed', 'object'])

/**
 * Whether this request is answered with the RSC payload alone, with no HTML render: a server
 * action (`Next-Action`), or a client navigation, prefetch or refresh, which the router sends
 * with `fetch` (`Sec-Fetch-Dest: empty`). Next hides its own `RSC` header from `headers()` and
 * from the proxy, so the fetch destination is what tells them apart. A request without the
 * header (a crawler, curl) is a page load. Once per request.
 */
export const flightOnlyRequest = cache(async (): Promise<boolean> => {
  const h = await headers()
  const dest = h.get('sec-fetch-dest')
  return h.has('next-action') || (dest !== null && !DOCUMENT_DESTINATIONS.has(dest))
})

/** Whether the visitor is a crawler (Next's user-agent check), once per request. */
export const crawlerRequest = cache(async (): Promise<boolean> => {
  return userAgent({ headers: await headers() }).isBot
})
