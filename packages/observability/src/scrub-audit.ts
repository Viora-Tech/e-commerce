import { scrubPii } from './scrub-pii'

const REDACTED = '[redacted]'

/** Credentials and payment details `scrubPii`'s key rule does not name. Compared lower case, `-`/`_` removed. */
const AUDIT_KEY =
  /^(keyid|cvv|cvc|upi|upiid|vpa|pan|aadhaar|ifsc|bankaccount|accountnumber)$|credential|signature/

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
/** A UPI id (`name@okaxis`): an email without a dot in its domain. */
const UPI_RE = /[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}\b/g
/**
 * JWTs, gateway and platform keys by their prefix (`rzp_live_…`, `sk_test_…`, `whsec_…`), and long
 * opaque base64 runs. Handles, slugs and UUIDs have hyphens or are shorter, so they stay readable.
 */
const SECRET_RE =
  /\b(?:eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|(?:rzp|sk|pk|rk|whsec|ghp|gho|ghs|xox[a-z])_[A-Za-z0-9_]{8,}|[A-Za-z0-9_]{40,})/g

const MAX_STRING = 500
const MAX_ITEMS = 50
const MAX_DEPTH = 6

const normaliseKey = (key: string) => key.toLowerCase().replace(/[-_]/g, '')

/** `scrubPii`'s key rule (emails, phones, addresses, OTPs, anything naming a credential) plus `AUDIT_KEY`. */
function sensitiveKey(key: string): boolean {
  if (!key) return false
  if (scrubPii({ [key]: true })[key] !== true) return true
  return AUDIT_KEY.test(normaliseKey(key))
}

function scrubString(value: string): string {
  const text = value
    .replace(SECRET_RE, REDACTED)
    .replace(EMAIL_RE, REDACTED)
    .replace(UPI_RE, REDACTED)
  return text.length > MAX_STRING ? `${text.slice(0, MAX_STRING - 1)}…` : text
}

function scrubValue(value: unknown, key: string, depth: number): unknown {
  if (sensitiveKey(key))
    return value === null || value === undefined || value === '' ? value : REDACTED
  if (typeof value === 'string') return scrubString(value)
  if (value === null || typeof value !== 'object')
    return typeof value === 'bigint' ? String(value) : value
  if (value instanceof Date) return value.toISOString()
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return { file: typeof File !== 'undefined' && value instanceof File ? value.name : 'file' }
  }
  if (depth >= MAX_DEPTH) return '…'
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((v) => scrubValue(v, '', depth + 1))
    return value.length > MAX_ITEMS ? [...items, `… ${value.length - MAX_ITEMS} more`] : items
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'function' || v === undefined) continue
    out[k] = scrubValue(v, k, depth + 1)
  }
  return out
}

/**
 * SOURCE OF TRUTH KEYWORDS: scrubAudit, activity log redaction, store_activity changes
 * WHAT:  A copy of a procedure's input (or a before/after pair) safe to keep in the store's
 *        activity log: credentials, payment details, OTPs, emails, phones and addresses are
 *        `[redacted]` by key (the same key rule as `scrubPii`, the logger's and Sentry's), and
 *        secret-looking or email strings anywhere else; long strings and lists are clipped.
 * WHY:   The log is kept for a year and read by staff; it records what changed, never a key, a
 *        token, a password or a shopper's contact details. Unlike `scrubLogEvent` it leaves
 *        dates, prices and handles readable, since those are what a merchant looks for.
 * WHERE: `packages/api/src/procedures/activity.ts`, before each `store_activity` insert.
 */
export function scrubAudit<T>(value: T): unknown {
  return scrubValue(value, '', 0)
}
