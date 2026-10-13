import { scrubPii } from './scrub-pii'

/**
 * Fields evlog itself writes whose values are never personal data and that `scrubPii`'s
 * phone/token patterns would mangle (an ISO timestamp reads as a phone number, a commit SHA
 * or trace id as a token). Top level only.
 */
const TRUSTED_KEYS = new Set([
  'timestamp',
  'level',
  'service',
  'environment',
  'version',
  'commitHash',
  'region',
  'requestId',
  'traceId',
  'spanId',
  'duration',
  'durationMs',
])

/** Record ids are UUIDs: kept as they are, since a log line without its store or order id is useless. */
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** `scrubPii` on the text around each UUID, the UUIDs themselves untouched. */
function scrubText(text: string): string {
  let out = ''
  let last = 0
  for (const match of text.matchAll(UUID_RE)) {
    out += scrubPii(text.slice(last, match.index)) + match[0]
    last = match.index + match[0].length
  }
  return out + scrubPii(text.slice(last))
}

function scrubField(key: string, value: unknown): unknown {
  // Same key rule as scrubPii (email, phone, address, cookie, anything naming a credential).
  const probe = scrubPii({ [key]: true })[key]
  if (probe !== true) return probe
  if (typeof value === 'string') return scrubText(value)
  if (Array.isArray(value)) return value.map((v) => scrubField('', v))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = scrubField(k, v)
    return out
  }
  return value
}

/**
 * SOURCE OF TRUTH KEYWORDS: scrubLogEvent, log redaction, wide event PII
 * WHAT:  Redacts PII from an evlog wide event in place, before it is printed or drained.
 * WHY:   Logs follow the same privacy rule as error events (`scrubPii`): no emails, phones,
 *        tokens, addresses or cookies leave the process. Only record ids (UUIDs) and evlog's
 *        own bookkeeping fields are spared, so events stay searchable by store and order.
 * WHERE: `redact.transform` in `logOptions` (log-options.ts); see docs/ops/logging.md.
 */
export function scrubLogEvent(event: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(event)) {
    if (TRUSTED_KEYS.has(key) && (typeof value === 'string' || typeof value === 'number')) continue
    event[key] = scrubField(key, value)
  }
}
