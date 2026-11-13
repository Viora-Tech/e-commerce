/** SOURCE OF TRUTH: signHonoPreviewToken, readHonoPreviewToken, keepOwnerOnlyPreferences
 * WHAT:  The owner's preview of the faster product pages (`delivery.honoProduct`, the Bun + Hono
 *        service) in their own browser while the store's switch is still off, and the rule that
 *        only the owner changes that switch.
 * WHY:   The owner tries the pages on the live store before shoppers do. The admin (owner only)
 *        signs a short-lived link (`?hono=<token>`); the storefront checks it and sets the cookie
 *        `wc_hono=on` for that browser alone. An unsigned `?hono=on` does nothing, so a shared or
 *        guessed link turns nothing on for anyone else, and an expired one neither.
 *
 * Format: `<exp>.<sig>`, the store id inside the signature (a link for one store never works on
 * another).
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { StorePreferences } from './preferences'

const PURPOSE = 'hono-preview'
export const HONO_PREVIEW_TTL_SECONDS = 60 * 60

const sign = (secret: string, storeId: string, exp: number): string =>
  createHmac('sha256', secret).update(`${PURPOSE}:${storeId}:${exp}`).digest('base64url')

export function signHonoPreviewToken(opts: {
  secret: string
  storeId: string
  now?: number
  ttlSeconds?: number
}): string {
  const exp =
    Math.floor((opts.now ?? Date.now()) / 1000) + (opts.ttlSeconds ?? HONO_PREVIEW_TTL_SECONDS)
  return `${exp}.${sign(opts.secret, opts.storeId, exp)}`
}

/** Whether `token` is a live preview grant for this store. */
export function readHonoPreviewToken(opts: {
  secret: string
  storeId: string
  token: string
  now?: number
}): boolean {
  if (!opts.secret || opts.token.length > 120) return false
  const [expText, sig, ...rest] = opts.token.split('.')
  const exp = Number(expText)
  if (rest.length > 0 || !sig || !Number.isInteger(exp)) return false
  if (exp * 1000 <= (opts.now ?? Date.now())) return false
  const want = Buffer.from(sign(opts.secret, opts.storeId, exp))
  const given = Buffer.from(sig)
  return want.length === given.length && timingSafeEqual(want, given)
}

/**
 * The preferences a save stores: a member who is not the owner keeps the owner-only switch as
 * it is (`delivery.honoProduct`), whatever the form sent, so the shared preferences save cannot
 * be used to change it.
 */
export function keepOwnerOnlyPreferences(
  input: StorePreferences,
  stored: StorePreferences,
  isOwner: boolean,
): StorePreferences {
  if (isOwner) return input
  return { ...input, delivery: { ...input.delivery, honoProduct: stored.delivery.honoProduct } }
}
