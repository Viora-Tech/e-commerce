/** SOURCE OF TRUTH: shopper login hand-off tokens — WHAT: HMAC-signed short-lived payloads (the sign-in start request, the single-use hand-off token back to the store's domain, pending-link and passkey-challenge cookies), their checks (tampered, expired, wrong store, wrong return URL) and the return URL allow-list / WHY: social sign-in runs on one platform login domain while stores live on many domains, so the session must come back to exactly the store and URL that asked for it, never to a foreign host */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/*
 * Pure (no database). Keys are derived from SETTINGS_SECRET per purpose, so a token
 * signed for one purpose (say, a passkey challenge cookie) never verifies as another
 * (a hand-off). Single use is enforced by the ticket row (`tickets.ts`), not here.
 */

export type TokenPurpose =
  | 'start'
  | 'oauth'
  | 'handoff'
  | 'pending-link'
  | 'passkey'
  | 'one-tap'
  /** A newsletter confirm link (`customers/newsletter.ts`). */
  | 'newsletter'

/** A sign-in start request is good for 10 minutes: time to pick an account at the provider. */
export const START_TTL_MS = 10 * 60 * 1000
/** A hand-off token is good for 2 minutes: it is followed by a redirect straight away. */
export const HANDOFF_TTL_MS = 2 * 60 * 1000

/** The only path a hand-off may return to on the store's domain. */
export const HANDOFF_RETURN_PATH = '/account/login/complete'

export const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex')

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url')

const keyFor = (secret: string, purpose: TokenPurpose): Buffer =>
  createHmac('sha256', secret).update(`shopper-login:${purpose}`).digest()

const mac = (key: Buffer, body: string): string =>
  createHmac('sha256', key).update(body).digest('base64url')

/** Constant-time string equality (length leaks only). */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** `base64url(json).signature`, expiring at `e` (ms since epoch). */
export function signToken<T extends { e: number }>(
  payload: T,
  secret: string,
  purpose: TokenPurpose,
): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${mac(keyFor(secret, purpose), body)}`
}

export type OpenResult<T> =
  | { ok: true; payload: T }
  | { ok: false; reason: 'malformed' | 'tampered' | 'expired' }

/** Check the signature, then the expiry. Never returns a payload whose signature failed. */
export function openToken<T extends { e: number }>(
  token: unknown,
  secret: string,
  purpose: TokenPurpose,
  now: Date = new Date(),
): OpenResult<T> {
  if (typeof token !== 'string' || token.length > 4096) return { ok: false, reason: 'malformed' }
  const [body, sig, extra] = token.split('.')
  if (!body || !sig || extra !== undefined) return { ok: false, reason: 'malformed' }
  if (!safeEqual(sig, mac(keyFor(secret, purpose), body))) return { ok: false, reason: 'tampered' }
  let payload: T
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (!payload || typeof payload.e !== 'number') return { ok: false, reason: 'malformed' }
  if (payload.e <= now.getTime()) return { ok: false, reason: 'expired' }
  return { ok: true, payload }
}

/**
 * The return URL a hand-off may go to: `https://<one of the store's live domains>/account/login/complete`,
 * nothing else (no other path, no credentials, no fragment). Development also allows
 * http and a port, so `http://waimers.localhost:3100` works. Returns the normalised URL.
 */
export function checkReturnUrl(
  raw: unknown,
  allowedHosts: readonly string[],
  opts: { dev: boolean },
): string | null {
  if (typeof raw !== 'string' || raw.length > 512) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  const schemeOk = url.protocol === 'https:' || (opts.dev && url.protocol === 'http:')
  if (!schemeOk || url.username || url.password || url.hash || url.search) return null
  if (url.port && !opts.dev) return null
  if (url.pathname !== HANDOFF_RETURN_PATH) return null
  const host = url.hostname.toLowerCase()
  if (!allowedHosts.some((h) => h.toLowerCase() === host)) return null
  return url.toString()
}

/** Where a sign-in started: which store, where to come back, which browser. */
export type StartPayload = {
  v: 1
  /** Store id. */
  s: string
  /** Return URL (checked against the store's domains again on the login domain). */
  r: string
  p: 'google' | 'apple' | 'facebook'
  /** sha256 of the random value in the starting browser's cookie on the store domain. */
  b: string
  /** Same-site path to land on after. */
  x: string
  /** Remember this device. */
  m: boolean
  /** Signed-in customer connecting this provider to their account, if any. */
  c?: string | undefined
  e: number
}

export type HandoffPayload = {
  v: 1
  s: string
  r: string
  /** Random id; its hash is the ticket row's key. */
  j: string
  e: number
}

export type HandoffCheck =
  | { ok: true; jti: string }
  | { ok: false; reason: 'malformed' | 'tampered' | 'expired' | 'wrong_store' | 'wrong_return' }

/**
 * Verify a hand-off token on the store's domain: signature, expiry, the store the
 * request's hostname resolved to, and the exact URL it arrived at. Single use is the
 * ticket's job (`redeemHandoff`).
 */
export function checkHandoffToken(
  token: unknown,
  expect: { secret: string; storeId: string; returnUrl: string; now?: Date },
): HandoffCheck {
  const opened = openToken<HandoffPayload>(token, expect.secret, 'handoff', expect.now)
  if (!opened.ok) return opened
  const p = opened.payload
  if (p.v !== 1 || typeof p.j !== 'string' || p.j.length < 20) {
    return { ok: false, reason: 'malformed' }
  }
  if (p.s !== expect.storeId) return { ok: false, reason: 'wrong_store' }
  if (p.r !== expect.returnUrl) return { ok: false, reason: 'wrong_return' }
  return { ok: true, jti: p.j }
}

/**
 * Same-site path only, never another origin (`//evil.com`, `/\\evil.com`). Control
 * characters and backslashes are refused anywhere: browsers drop tab, CR and LF while
 * parsing, so `/\t/evil.com` would otherwise be followed as `//evil.com`.
 */
export function safeNextPath(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 512) return '/account'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/account'
  // biome-ignore lint/suspicious/noControlCharactersInRegex: refusing them is the point
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return '/account'
  const base = 'https://same-site.invalid'
  const url = new URL(raw, base)
  return url.origin === base ? raw : '/account'
}
