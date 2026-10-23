/** SOURCE OF TRUTH: platform app signatures — WHAT: Meta and Shopify webhook, signed_request and OAuth callback checks / WHY: every callback from an outside platform is verified before it is read */
/**
 * The checks every callback from an outside platform's app passes before anything reads it.
 * All compare in constant time and answer `false`/`null` rather than throw, so a route can
 * reject with one reply whatever went wrong.
 *
 * - Meta webhooks: `X-Hub-Signature-256: sha256=<hex HMAC-SHA256 of the raw body, app secret>`.
 * - Meta `signed_request` (deauthorize and data deletion callbacks):
 *   `<base64url sig>.<base64url JSON>`, the sig an HMAC-SHA256 of the payload part.
 * - Shopify webhooks: `X-Shopify-Hmac-Sha256: <base64 HMAC-SHA256 of the raw body, client secret>`.
 * - Shopify OAuth redirects: `hmac` over the other query parameters, sorted, as `k=v&k=v`.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Meta's `X-Hub-Signature-256` header against the raw request body. */
export function verifyMetaSignature(
  rawBody: string,
  header: string | null | undefined,
  appSecret: string,
): boolean {
  if (!header?.startsWith('sha256=') || !appSecret) return false
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')
  return sameText(header.slice('sha256='.length).toLowerCase(), expected)
}

export type MetaSignedRequest = {
  user_id?: string
  algorithm?: string
  issued_at?: number
  [key: string]: unknown
}

/** Meta's `signed_request` form field; null when the signature or algorithm is wrong. */
export function parseMetaSignedRequest(
  signed: string | null | undefined,
  appSecret: string,
): MetaSignedRequest | null {
  if (!signed || !appSecret) return null
  const [sig, payload] = signed.split('.', 2)
  if (!sig || !payload) return null
  const expected = createHmac('sha256', appSecret).update(payload).digest('base64url')
  if (!sameText(sig.replace(/=+$/, ''), expected)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as MetaSignedRequest
    if (String(data.algorithm ?? '').toUpperCase() !== 'HMAC-SHA256') return null
    return data
  } catch {
    return null
  }
}

/** Shopify's `X-Shopify-Hmac-Sha256` header against the raw request body. */
export function verifyShopifyWebhook(
  rawBody: string,
  header: string | null | undefined,
  clientSecret: string,
): boolean {
  if (!header || !clientSecret) return false
  const expected = createHmac('sha256', clientSecret).update(rawBody, 'utf8').digest('base64')
  return sameText(header, expected)
}

/**
 * Shopify's `hmac` on an OAuth redirect or app URL: every other query parameter, sorted by
 * name, joined as `name=value&…`, HMAC-SHA256 hex with the app's client secret.
 */
export function verifyShopifyQueryHmac(
  params: URLSearchParams | Record<string, string>,
  clientSecret: string,
): boolean {
  const entries = (
    params instanceof URLSearchParams ? [...params.entries()] : Object.entries(params)
  ).filter(([k]) => k !== 'hmac' && k !== 'signature')
  const given =
    params instanceof URLSearchParams ? params.get('hmac') : (params as Record<string, string>).hmac
  if (!given || !clientSecret) return false
  const sorted = entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  // Shopify's own libraries differ on whether values are URL-encoded first; the parameters it
  // sends (code, shop, state, timestamp, host) rarely need it, so either form is accepted.
  const plain = sorted.map(([k, v]) => `${k}=${v}`).join('&')
  const encoded = new URLSearchParams(sorted).toString()
  const sign = (m: string) => createHmac('sha256', clientSecret).update(m).digest('hex')
  const mac = given.toLowerCase()
  return sameText(mac, sign(plain)) || (encoded !== plain && sameText(mac, sign(encoded)))
}
