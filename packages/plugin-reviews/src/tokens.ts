import { openToken, signToken } from '@commerce/core'

/*
 * Signed links the Reviews app hands out (HMAC from SETTINGS_SECRET, purpose `review`):
 * the "write a review" link in a request email (proves which order and product, so the
 * review is a verified buyer's), a photo the storefront just stored (so a review can only
 * attach photos this visitor uploaded) and the stop-review-emails link. Each carries its
 * kind and the store, so one never opens as another or in another store.
 */

const DAY = 24 * 60 * 60 * 1000

/** A request link works for 60 days after the email. */
const REQUEST_LINK_TTL_MS = 60 * DAY
/** A stored photo must be attached to a review within 2 hours. */
const PHOTO_TOKEN_TTL_MS = 2 * 60 * 60 * 1000
/** The stop link keeps working for two years. */
const UNSUBSCRIBE_TTL_MS = 730 * DAY

type RequestPayload = { k: 'req'; s: string; o: string; p: string; e: number }
type PhotoPayload = { k: 'photo'; s: string; m: string; e: number }
type UnsubscribePayload = { k: 'unsub'; s: string; r: string; e: number }

export function requestLinkToken(
  secret: string,
  input: { storeId: string; orderId: string; productId: string },
  now = Date.now(),
): string {
  const payload: RequestPayload = {
    k: 'req',
    s: input.storeId,
    o: input.orderId,
    p: input.productId,
    e: now + REQUEST_LINK_TTL_MS,
  }
  return signToken(payload, secret, 'review')
}

/** The order and product a request link stands for, when it is genuine, current and this store's. */
export function openRequestLink(
  secret: string,
  token: unknown,
  storeId: string,
  now = new Date(),
): { orderId: string; productId: string } | null {
  const r = openToken<RequestPayload>(token, secret, 'review', now)
  if (!r.ok || r.payload.k !== 'req' || r.payload.s !== storeId) return null
  return { orderId: r.payload.o, productId: r.payload.p }
}

export function photoToken(secret: string, storeId: string, mediaId: string, now = Date.now()) {
  const payload: PhotoPayload = { k: 'photo', s: storeId, m: mediaId, e: now + PHOTO_TOKEN_TTL_MS }
  return signToken(payload, secret, 'review')
}

export function openPhotoToken(
  secret: string,
  token: unknown,
  storeId: string,
  now = new Date(),
): string | null {
  const r = openToken<PhotoPayload>(token, secret, 'review', now)
  if (!r.ok || r.payload.k !== 'photo' || r.payload.s !== storeId) return null
  return r.payload.m
}

export function unsubscribeToken(
  secret: string,
  storeId: string,
  requestId: string,
  now = Date.now(),
) {
  const payload: UnsubscribePayload = {
    k: 'unsub',
    s: storeId,
    r: requestId,
    e: now + UNSUBSCRIBE_TTL_MS,
  }
  return signToken(payload, secret, 'review')
}

export function openUnsubscribeToken(
  secret: string,
  token: unknown,
  storeId: string,
  now = new Date(),
): string | null {
  const r = openToken<UnsubscribePayload>(token, secret, 'review', now)
  if (!r.ok || r.payload.k !== 'unsub' || r.payload.s !== storeId) return null
  return r.payload.r
}
