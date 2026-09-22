import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Document links go out by email and sit on the storefront order page, which
 * has no login, so the URL itself is the credential: an HMAC over the store,
 * the document and an expiry, keyed from the settings secret. Order numbers
 * are guessable; this is not. Server only (node:crypto).
 */
function key(secret: string): Buffer {
  return createHmac('sha256', secret).update('gst-invoices-download-link').digest()
}

export type LinkInput = { storeId: string; documentId: string }

/** How long an emailed link keeps working. */
export const LINK_TTL_SECONDS = 60 * 60 * 24 * 30

function mac(secret: string, input: LinkInput, expires: number): string {
  return createHmac('sha256', key(secret))
    .update(`${input.storeId}:${input.documentId}:${expires}`)
    .digest('base64url')
    .slice(0, 32)
}

export function signDocumentLink(
  secret: string,
  input: LinkInput,
  now: Date = new Date(),
  ttlSeconds: number = LINK_TTL_SECONDS,
): { expires: number; token: string } {
  const expires = Math.floor(now.getTime() / 1000) + ttlSeconds
  return { expires, token: mac(secret, input, expires) }
}

export function verifyDocumentLink(
  secret: string,
  input: LinkInput & { expires: number; token: string },
  now: Date = new Date(),
): boolean {
  if (!Number.isInteger(input.expires) || input.expires < Math.floor(now.getTime() / 1000)) {
    return false
  }
  const expected = Buffer.from(mac(secret, input, input.expires))
  const given = Buffer.from(input.token)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/** `/documents/<id>?e=…&t=…` on the storefront host; the proxy maps it to the store. */
export function documentLinkPath(secret: string, input: LinkInput, now?: Date): string {
  const { expires, token } = signDocumentLink(secret, input, now)
  return `/documents/${input.documentId}?e=${expires}&t=${token}`
}
