import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * A short-lived grant for previewing a theme on the storefront. The admin signs one
 * per editor session (live draft over postMessage) or per Preview click (a saved,
 * possibly unpublished theme). The storefront only renders a non-live theme, skips
 * the password page, or listens for unsaved overrides when the token is valid for
 * that store and not expired, so a third-party site framing the storefront cannot
 * restyle it.
 *
 * Format: `<exp>.<sig>` for the store's live theme, `<exp>.<themeId>.<sig>` for a
 * specific theme. The theme id is inside the signature, so it cannot be swapped.
 */
const PURPOSE = 'theme-preview'
export const THEME_PREVIEW_TTL_SECONDS = 60 * 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const payload = (storeId: string, exp: number, themeId: string | null): string =>
  themeId ? `${PURPOSE}:${storeId}:${themeId}:${exp}` : `${PURPOSE}:${storeId}:${exp}`

const sign = (secret: string, text: string): string =>
  createHmac('sha256', secret).update(text).digest('base64url')

export function signThemePreviewToken(opts: {
  secret: string
  storeId: string
  /** Preview this saved theme instead of the live one. */
  themeId?: string | null | undefined
  now?: number
  ttlSeconds?: number
}): string {
  const now = opts.now ?? Date.now()
  const exp = Math.floor(now / 1000) + (opts.ttlSeconds ?? THEME_PREVIEW_TTL_SECONDS)
  const themeId = opts.themeId ?? null
  const sig = sign(opts.secret, payload(opts.storeId, exp, themeId))
  return themeId ? `${exp}.${themeId}.${sig}` : `${exp}.${sig}`
}

/** The grant a token carries, or null when it is malformed, forged or expired. */
export function readThemePreviewToken(opts: {
  secret: string
  storeId: string
  token: string
  now?: number
}): { themeId: string | null } | null {
  if (opts.token.length > 200) return null
  const parts = opts.token.split('.')
  if (parts.length !== 2 && parts.length !== 3) return null
  const exp = Number(parts[0])
  const themeId = parts.length === 3 ? (parts[1] ?? '') : null
  const sig = parts.at(-1)
  if (!sig || !Number.isInteger(exp)) return null
  if (themeId !== null && !UUID.test(themeId)) return null
  if (exp * 1000 <= (opts.now ?? Date.now())) return null
  const expected = Buffer.from(sign(opts.secret, payload(opts.storeId, exp, themeId)))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  return { themeId }
}

export function verifyThemePreviewToken(opts: {
  secret: string
  storeId: string
  token: string
  now?: number
}): boolean {
  return readThemePreviewToken(opts) !== null
}
