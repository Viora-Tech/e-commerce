import { createHash, createHmac } from 'node:crypto'
import { safeEqual } from '@commerce/payments'

/**
 * The storefront password page's pass. Entering the password sets a signed cookie
 * scoped to the store; the signature covers a digest of the current password, so
 * changing the password in Preferences signs everyone out.
 */
export const ACCESS_COOKIE = 'wc_access'
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 30

const PURPOSE = 'storefront-access'

const digest = (password: string): string =>
  createHash('sha256').update(password.trim()).digest('base64url').slice(0, 22)

const sign = (secret: string, storeId: string, password: string, exp: number): string =>
  createHmac('sha256', secret)
    .update(`${PURPOSE}:${storeId}:${digest(password)}:${exp}`)
    .digest('base64url')

/** Whether a typed password matches the store's, compared in constant time. */
export function checkStorefrontPassword(expected: string, given: string): boolean {
  if (!expected.trim()) return false
  return safeEqual(digest(expected), digest(given))
}

export function signStorefrontAccess(opts: {
  secret: string
  storeId: string
  password: string
  now?: number
}): string {
  const exp = Math.floor((opts.now ?? Date.now()) / 1000) + ACCESS_MAX_AGE
  return `${exp}.${sign(opts.secret, opts.storeId, opts.password, exp)}`
}

export function verifyStorefrontAccess(opts: {
  secret: string
  storeId: string
  password: string
  token: string | null | undefined
  now?: number
}): boolean {
  if (!opts.token || opts.token.length > 200) return false
  const [expRaw, sig] = opts.token.split('.')
  const exp = Number(expRaw)
  if (!sig || !Number.isInteger(exp)) return false
  if (exp * 1000 <= (opts.now ?? Date.now())) return false
  return safeEqual(sign(opts.secret, opts.storeId, opts.password, exp), sig)
}
