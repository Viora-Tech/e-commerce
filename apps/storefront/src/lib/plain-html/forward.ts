import 'server-only'
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http'
import { Readable } from 'node:stream'
import { settingsSecret } from '@commerce/config'
import { headers } from 'next/headers'
import { NONCE_HEADER } from '../csp'
import { DERIVED_HEADERS } from '../routing'
import { PLAIN_SKIP_HEADER, plainSkipToken } from './route'

/**
 * Hands a page the plain HTML path cannot draw back to the React page, through this same server
 * (as `lib/cache-warm.ts` warms pages): the same path, host and cookies, marked with a signed
 * `x-plain-skip` so the proxy rewrites it to the React page this time and keeps the nonce the
 * outer response's CSP header already names. The answer streams back as it arrives.
 *
 * Its `Set-Cookie`s are dropped: the outer request's proxy already set the same cookies (the
 * visitor id it mints would otherwise come twice, with two values).
 */

/** Request headers never passed on: hop-by-hop, the proxy's own, and compression (Next adds it). */
const DROP_REQUEST = new Set([
  'connection',
  'content-length',
  'transfer-encoding',
  'accept-encoding',
  'keep-alive',
  'upgrade',
  NONCE_HEADER,
  'content-security-policy',
  ...DERIVED_HEADERS,
])

/** Response headers never passed back. */
const DROP_RESPONSE = new Set([
  'set-cookie',
  'connection',
  'content-length',
  'content-encoding',
  'transfer-encoding',
  'keep-alive',
])

/** How long a hand-back may take before the shopper gets an error instead of a hung page. */
const FORWARD_TIMEOUT_MS = 30_000

function responseHeaders(raw: IncomingHttpHeaders): Headers {
  const out = new Headers()
  for (const [name, value] of Object.entries(raw)) {
    // `x-middleware-*`: the inner proxy's own markers; passed back, Next reads a rewrite.
    if (value === undefined || DROP_RESPONSE.has(name) || name.startsWith('x-middleware-')) continue
    for (const v of Array.isArray(value) ? value : [value]) out.append(name, v)
  }
  return out
}

/** The React page for this request, fetched from this server. */
export async function forwardToReactPage(req: Request): Promise<Response> {
  const h = await headers()
  const nonce = h.get(NONCE_HEADER) ?? ''
  const secret = settingsSecret()
  if (!nonce || !secret) return new Response('Service unavailable', { status: 503 })
  const path = `${h.get('x-pathname') ?? '/'}${new URL(req.url).search}`
  const out: Record<string, string> = {}
  req.headers.forEach((value, name) => {
    if (!DROP_REQUEST.has(name)) out[name] = value
  })
  out[PLAIN_SKIP_HEADER] = plainSkipToken(secret, nonce)
  return new Promise((resolve) => {
    const inner = httpRequest(
      {
        host: '127.0.0.1',
        port: Number(process.env.PORT ?? 3100),
        path,
        method: req.method === 'HEAD' ? 'HEAD' : 'GET',
        timeout: FORWARD_TIMEOUT_MS,
        headers: out,
      },
      (res) => {
        const body =
          req.method === 'HEAD' ? null : (Readable.toWeb(res) as unknown as ReadableStream)
        resolve(
          new Response(body, {
            status: res.statusCode ?? 502,
            headers: responseHeaders(res.headers),
          }),
        )
      },
    )
    inner.on('timeout', () => inner.destroy(new Error('timeout')))
    inner.on('error', () => resolve(new Response('Bad gateway', { status: 502 })))
    inner.end()
  })
}
