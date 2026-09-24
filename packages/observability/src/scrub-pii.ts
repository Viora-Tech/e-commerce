/**
 * Redacts PII from a Sentry event before it leaves the process, for
 * `beforeSend`/`beforeSendTransaction` in every app (admin, storefront,
 * worker). Kept dependency-free so it is unit-testable without the Sentry
 * SDK and reusable from `@sentry/nextjs`, `@sentry/bun` or `@sentry/node`.
 *
 * Two passes: known-sensitive keys are redacted outright (whatever their
 * value), and every remaining string is scanned for email/phone/token-like
 * substrings. Neither pass needs the caller to know Sentry's event shape.
 */
export type JsonLike = { [key: string]: JsonLike } | JsonLike[] | string | number | boolean | null

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
/** +91 98765 43210, (022) 1234-5678, 9876543210 — 7+ digits, optional separators. */
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/g
/** JWTs (header.payload.signature) or long opaque secrets (24+ base64url-ish characters). */
const TOKEN_RE =
  /\b(?:[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{2,}|[A-Za-z0-9_-]{24,})\b/g

const REDACTED = '[redacted]'

/** Object keys redacted outright, wherever they appear in the event tree. */
const SENSITIVE_KEYS = new Set([
  'email',
  'email_address',
  'phone',
  'phone_number',
  'address',
  'address1',
  'address2',
  'billing_address',
  'shipping_address',
  'ip_address',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'apikey',
  'secret',
  'authorization',
  'cookie',
  'cookies',
  'set-cookie',
])

function scrubString(value: string): string {
  return value.replace(EMAIL_RE, REDACTED).replace(PHONE_RE, REDACTED).replace(TOKEN_RE, REDACTED)
}

function scrubValue(value: unknown, keyHint?: string): unknown {
  if (keyHint && SENSITIVE_KEYS.has(keyHint.toLowerCase())) return REDACTED
  if (typeof value === 'string') return scrubString(value)
  if (Array.isArray(value)) return value.map((v) => scrubValue(v))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubValue(v, k)
    }
    return out
  }
  return value
}

/**
 * Scrubs a Sentry event in place-equivalent fashion (returns a new object;
 * never mutates the input). Safe to pass any JSON-shaped object, so it works
 * for the full event, `event.extra`, breadcrumb data, etc.
 */
export function scrubPii<T>(event: T): T {
  return scrubValue(event) as T
}
