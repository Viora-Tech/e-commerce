import 'server-only'
import { settingsSecret } from '@commerce/config'
import { headers } from 'next/headers'
import { NONCE_HEADER } from '../csp'
import {
  HONO_FORWARD_HEADER,
  HONO_HOST_HEADER,
  type HonoAnswer,
  type HonoVerdict,
  honoForwardToken,
  honoVerdict,
} from './route'
import { honoEnv, noteHono } from './state'

/**
 * Fetches a product page from the Bun + Hono service (`STOREFRONT_HONO_URL`) for the forward
 * route (`app/-x/[storeId]/products/[handle]/route.ts`): the request headers the proxy derived
 * (store, path, market, nonce, the shopper's cookies), signed with `x-hono-forward` so the service
 * trusts them. The service writes the whole page before it answers, so the body is read here in
 * full and the route can still draw the Next page if anything goes wrong.
 */

/** Request headers never passed on: hop-by-hop, compression (the body is read here as text). */
const DROP_REQUEST = new Set([
  'connection',
  'content-length',
  'transfer-encoding',
  'accept-encoding',
  'keep-alive',
  'upgrade',
  'content-security-policy',
  'content-security-policy-report-only',
  'host',
  HONO_FORWARD_HEADER,
  HONO_HOST_HEADER,
])

export type HonoPage = { html: string; verdict: HonoVerdict }

/** The service's page for this request and the verdict on it; `html` is empty unless used. */
export async function fetchHonoPage(req: Request): Promise<HonoPage> {
  const { url, timeoutMs } = honoEnv()
  const h = await headers()
  const nonce = h.get(NONCE_HEADER) ?? ''
  const storeId = h.get('x-store-id') ?? ''
  const host = h.get('host') ?? ''
  const secret = settingsSecret()
  if (!url || !nonce || !storeId || !host || !secret) {
    return { html: '', verdict: { use: false, reason: 'not-configured', failure: false } }
  }
  const path = `${h.get('x-pathname') ?? '/'}${new URL(req.url).search}`
  const out = new Headers()
  h.forEach((value, name) => {
    if (!DROP_REQUEST.has(name)) out.set(name, value)
  })
  out.set(HONO_HOST_HEADER, host)
  out.set(HONO_FORWARD_HEADER, honoForwardToken(secret, { storeId, host, nonce }))
  let answer: HonoAnswer
  let html = ''
  try {
    const res = await fetch(`${url}${path}`, {
      headers: out,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })
    answer = {
      status: res.status,
      render: res.headers.get('x-storefront-render'),
      contentType: res.headers.get('content-type'),
      skip: res.headers.get('x-plain-skip-reason'),
    }
    // Read even when unused, so the connection goes back to the pool.
    html = await res.text()
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    answer = { error: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'unreachable' }
  }
  const verdict = honoVerdict(answer)
  noteHono(verdict)
  return { html: verdict.use ? html : '', verdict }
}
