/** Per-field messages an API validation failure carries in `data.errors`, keyed by field. */
export function fieldErrorsOf(err: unknown): Record<string, string> {
  const data = (err as { data?: { errors?: Record<string, string> } } | null)?.data
  return data?.errors ?? {}
}

export type ValidationIssue = {
  /** Dotted path into the request, e.g. `variants.0.sku`. */
  path: string
  message: string
  /** Set for "too big" issues on text or lists: the limit that was exceeded. */
  max?: number
}

/** The zod issues an API "Input validation failed" error carries in `data.issues`. */
export function validationIssuesOf(err: unknown): ValidationIssue[] {
  const issues = (err as { data?: { issues?: unknown } } | null)?.data?.issues
  if (!Array.isArray(issues)) return []
  return issues.map((raw) => {
    const i = raw as { message?: string; path?: unknown[]; code?: string; maximum?: number }
    const path = (i.path ?? [])
      .map((p) => (typeof p === 'object' && p !== null ? (p as { key: unknown }).key : p))
      .join('.')
    const issue: ValidationIssue = { path, message: i.message ?? '' }
    if (i.code === 'too_big' && typeof i.maximum === 'number') issue.max = i.maximum
    return issue
  })
}

/** What the API's validator says about one input it turned down (a zod issue, as sent). */
type RawIssue = {
  code?: string
  message?: string
  path?: unknown[]
  origin?: string
  format?: string
  maximum?: number
  minimum?: number
  input?: unknown
}

/** The copy `describeValidation` speaks with (`validationContent` in the member's language). */
export type ValidationCopy = {
  issue: (field: string, reason: string) => string
  more: (n: number) => string
  item: (n: number) => string
  request: string
  notId: string
  required: string
  tooLong: (max: number) => string
  tooShort: (min: number) => string
  tooMany: (max: number) => string
  tooFew: (min: number) => string
  tooBig: (max: number) => string
  tooSmall: (min: number) => string
  notAllowed: string
  badFormat: string
  fields: Record<string, string>
}

/** How many failed fields a message names before "and N more". */
const SHOWN = 3

function rawIssuesOf(err: unknown): RawIssue[] {
  const issues = (err as { data?: { issues?: unknown } } | null)?.data?.issues
  return Array.isArray(issues) ? (issues as RawIssue[]) : []
}

/** `weightUnit` → "Weight unit": a field the copy has no name for, spelled out. */
function spellOut(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : key
}

/** `['variants', 0, 'sku']` → "Variants (item 1) › SKU". */
function fieldName(path: unknown[], copy: ValidationCopy): string {
  const parts: string[] = []
  for (const raw of path) {
    const seg = typeof raw === 'object' && raw !== null ? (raw as { key: unknown }).key : raw
    if (typeof seg === 'number') {
      const label = copy.item(seg + 1)
      const last = parts.pop()
      parts.push(last === undefined ? label : `${last} (${label})`)
    } else if (typeof seg === 'string') {
      parts.push(copy.fields[seg] ?? spellOut(seg))
    }
  }
  return parts.length ? parts.join(' › ') : copy.request
}

function reasonOf(i: RawIssue, copy: ValidationCopy): string {
  const max = Number(i.maximum)
  const min = Number(i.minimum)
  switch (i.code) {
    case 'invalid_format':
      return i.format === 'uuid' || i.format === 'guid' ? copy.notId : copy.badFormat
    case 'invalid_type':
      return i.input == null ? copy.required : i.message || copy.badFormat
    case 'invalid_value':
      return copy.notAllowed
    case 'too_big':
      if (i.origin === 'string') return copy.tooLong(max)
      if (i.origin === 'array' || i.origin === 'set') return copy.tooMany(max)
      return copy.tooBig(max)
    case 'too_small':
      if (i.origin === 'string') return min <= 1 ? copy.required : copy.tooShort(min)
      if (i.origin === 'array' || i.origin === 'set') return copy.tooFew(min)
      return copy.tooSmall(min)
    default:
      return i.message || copy.badFormat
  }
}

/**
 * An "Input validation failed" error as a sentence naming the fields and why, e.g.
 * "Collections (item 2): not a valid ID". Null when `err` carries no validation issues.
 */
export function describeValidation(err: unknown, copy: ValidationCopy): string | null {
  const issues = rawIssuesOf(err)
  if (!issues.length) return null
  const lines = issues
    .slice(0, SHOWN)
    .map((i) => copy.issue(fieldName(i.path ?? [], copy), reasonOf(i, copy)))
  if (issues.length > SHOWN) lines.push(copy.more(issues.length - SHOWN))
  return lines.join('. ')
}

/**
 * Puts `describeValidation`'s sentence on `err` as its message, so every toast or alert
 * that shows `err.message` names the field. Other errors pass through untouched.
 */
export function withReadableValidation(err: unknown, copy: ValidationCopy): unknown {
  const text = describeValidation(err, copy)
  if (text && err instanceof Error) err.message = text
  return err
}
