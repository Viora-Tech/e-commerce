import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * A short-lived grant for the theme editor's live preview. The admin signs one per
 * editor session; the storefront only listens for unsaved theme overrides when the
 * page was opened with a token that is valid for that store and not expired, so a
 * third-party site framing the storefront cannot restyle it.
 */
const PURPOSE = 'theme-preview'
export const THEME_PREVIEW_TTL_SECONDS = 60 * 60

const sign = (secret: string, storeId: string, exp: number): string =>
  createHmac('sha256', secret).update(`${PURPOSE}:${storeId}:${exp}`).digest('base64url')

export function signThemePreviewToken(opts: {
  secret: string
  storeId: string
  now?: number
  ttlSeconds?: number
}): string {
  const now = opts.now ?? Date.now()
  const exp = Math.floor(now / 1000) + (opts.ttlSeconds ?? THEME_PREVIEW_TTL_SECONDS)
  return `${exp}.${sign(opts.secret, opts.storeId, exp)}`
}

export function verifyThemePreviewToken(opts: {
  secret: string
  storeId: string
  token: string
  now?: number
}): boolean {
  const [expRaw, sig] = opts.token.split('.')
  const exp = Number(expRaw)
  if (!sig || !Number.isInteger(exp)) return false
  if (exp * 1000 <= (opts.now ?? Date.now())) return false
  const expected = Buffer.from(sign(opts.secret, opts.storeId, exp))
  const given = Buffer.from(sig)
  return expected.length === given.length && timingSafeEqual(expected, given)
}
