import {
  type FieldDefinition,
  type FieldType,
  type FieldValidations,
  isReferenceType,
  NO_LIST_TYPES,
  type ReferenceType,
} from './schemas'

/**
 * Pure value validation for metaobject fields and metafields. Runs in the
 * browser (inline errors) and again on the server (the only check that counts).
 * Reference ids are only checked for shape here; the service confirms they
 * exist in this store.
 */

/** What a field needs to validate a value; metafield definitions fit it too. */
export type FieldRule = {
  name: string
  type: FieldType
  list: boolean
  required?: boolean | undefined
  validations?: FieldValidations | undefined
}

export type FieldResult = { ok: true; value: unknown } | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const SINGLE_LINE_MAX = 5_000
const MULTI_LINE_MAX = 65_000
const URL_MAX = 2_048
const LIST_MAX = 250

/** `Size guide` → `size_guide`. Always a valid key (starts with a letter, max 64). */
export function keyFromName(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const key = /^[a-z]/.test(base) ? base : `f_${base}`
  return key.slice(0, 64).replace(/_+$/, '') || 'field'
}

/** Nothing entered: absent, null, blank text or an empty list. */
export function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.every(isEmptyValue)
  return false
}

function isRealDate(s: string): boolean {
  const m = DATE.exec(s)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '' && /^-?\d+(\.\d+)?$/.test(v.trim())) {
    return Number(v.trim())
  }
  return null
}

function checkBounds(n: number, rules: FieldValidations | undefined): string | null {
  if (typeof rules?.min === 'number' && n < rules.min) return `must be at least ${rules.min}`
  if (typeof rules?.max === 'number' && n > rules.max) return `must be at most ${rules.max}`
  return null
}

function checkText(s: string, hardMax: number, rules: FieldValidations | undefined): string | null {
  const max = Math.min(rules?.maxLength ?? hardMax, hardMax)
  if (s.length > max) return `must be ${max} characters or fewer`
  if (rules?.minLength !== undefined && s.length < rules.minLength) {
    return `must be at least ${rules.minLength} characters`
  }
  if (rules?.choices?.length && !rules.choices.includes(s)) {
    return `must be one of ${rules.choices.join(', ')}`
  }
  return null
}

/** One non-empty item of the given type: its normalised form, or why it is wrong. */
function validateItem(
  type: FieldType,
  v: unknown,
  rules: FieldValidations | undefined,
): FieldResult {
  switch (type) {
    case 'single_line_text': {
      if (typeof v !== 'string') return { ok: false, error: 'must be text' }
      const s = v.trim()
      if (/[\r\n]/.test(s)) return { ok: false, error: 'must be a single line' }
      const err = checkText(s, SINGLE_LINE_MAX, rules)
      return err ? { ok: false, error: err } : { ok: true, value: s }
    }
    case 'multi_line_text': {
      if (typeof v !== 'string') return { ok: false, error: 'must be text' }
      const s = v.replace(/\r\n/g, '\n').trim()
      const err = checkText(s, MULTI_LINE_MAX, { ...rules, choices: undefined })
      return err ? { ok: false, error: err } : { ok: true, value: s }
    }
    case 'rich_text': {
      const root = (v as { root?: unknown } | null)?.root
      if (typeof v !== 'object' || v === null || Array.isArray(v) || typeof root !== 'object') {
        return { ok: false, error: 'must be rich text' }
      }
      return { ok: true, value: v }
    }
    case 'number_integer': {
      const n = toNumber(v)
      if (n === null || !Number.isSafeInteger(n))
        return { ok: false, error: 'must be a whole number' }
      const err = checkBounds(n, rules)
      return err ? { ok: false, error: err } : { ok: true, value: n }
    }
    case 'number_decimal': {
      const n = toNumber(v)
      if (n === null) return { ok: false, error: 'must be a number' }
      const err = checkBounds(n, rules)
      return err ? { ok: false, error: err } : { ok: true, value: n }
    }
    case 'boolean': {
      if (typeof v === 'boolean') return { ok: true, value: v }
      if (v === 'true' || v === 'false') return { ok: true, value: v === 'true' }
      return { ok: false, error: 'must be yes or no' }
    }
    case 'date': {
      if (typeof v !== 'string' || !isRealDate(v.trim())) {
        return { ok: false, error: 'needs a date, like 2026-01-31' }
      }
      const s = v.trim()
      if (typeof rules?.min === 'string' && s < rules.min)
        return { ok: false, error: `must be on or after ${rules.min}` }
      if (typeof rules?.max === 'string' && s > rules.max)
        return { ok: false, error: `must be on or before ${rules.max}` }
      return { ok: true, value: s }
    }
    case 'url': {
      if (typeof v !== 'string') return { ok: false, error: 'must be a link' }
      const s = v.trim()
      if (s.length > URL_MAX) return { ok: false, error: 'is too long' }
      try {
        const u = new URL(s)
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          return { ok: false, error: 'must start with http:// or https://' }
        }
      } catch {
        return { ok: false, error: 'must be a full link, like https://example.com' }
      }
      return { ok: true, value: s }
    }
    case 'file':
    case 'product_reference':
    case 'collection_reference':
    case 'metaobject_reference': {
      if (typeof v !== 'string' || !UUID.test(v))
        return { ok: false, error: 'must be picked from the list' }
      return { ok: true, value: v.toLowerCase() }
    }
  }
}

/**
 * Validate one field. Empty input is `null` (or an error when required); a list
 * drops its empty items and validates the rest in order.
 */
export function validateFieldValue(rule: FieldRule, raw: unknown): FieldResult {
  const name = rule.name
  if (isEmptyValue(raw)) {
    return rule.required ? { ok: false, error: `${name} is required` } : { ok: true, value: null }
  }
  if (rule.list && !NO_LIST_TYPES.includes(rule.type)) {
    if (!Array.isArray(raw)) return { ok: false, error: `${name} must be a list` }
    const items = raw.filter((v) => !isEmptyValue(v))
    const max = Math.min(rule.validations?.maxItems ?? LIST_MAX, LIST_MAX)
    if (items.length > max) return { ok: false, error: `${name} can hold at most ${max} items` }
    const out: unknown[] = []
    for (const item of items) {
      const r = validateItem(rule.type, item, rule.validations)
      if (!r.ok) return { ok: false, error: `${name} ${r.error}` }
      out.push(r.value)
    }
    return { ok: true, value: out }
  }
  if (Array.isArray(raw)) return { ok: false, error: `${name} must be a single value` }
  const r = validateItem(rule.type, raw, rule.validations)
  return r.ok ? r : { ok: false, error: `${name} ${r.error}` }
}

export type FieldsResult = {
  /** Only defined keys with a value; empty optional fields are left out. */
  values: Record<string, unknown>
  /** Per key, the first problem found. Empty when everything is valid. */
  fieldErrors: Record<string, string>
}

/** Validate an entry against its definition's fields. Keys the definition does not know are dropped. */
export function validateFields(
  fields: readonly FieldDefinition[],
  raw: Record<string, unknown>,
): FieldsResult {
  const values: Record<string, unknown> = {}
  const fieldErrors: Record<string, string> = {}
  for (const field of fields) {
    const r = validateFieldValue(field, raw[field.key])
    if (!r.ok) fieldErrors[field.key] = r.error
    else if (r.value !== null) values[field.key] = r.value
  }
  return { values, fieldErrors }
}

export type ReferenceUse = {
  type: ReferenceType
  id: string
  /** Field key (or metafield definition id) the reference came from. */
  source: string
  /** For metaobject references, the definition the entry must belong to. */
  definitionId?: string | undefined
}

/** Every reference id in validated values, so the server can confirm each exists. */
export function collectReferences(
  rules: readonly (FieldRule & { source: string })[],
  values: Record<string, unknown>,
): ReferenceUse[] {
  const out: ReferenceUse[] = []
  for (const rule of rules) {
    if (!isReferenceType(rule.type)) continue
    const v = values[rule.source]
    const ids = Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]
    for (const id of ids) {
      if (typeof id !== 'string') continue
      out.push({
        type: rule.type,
        id,
        source: rule.source,
        definitionId: rule.validations?.metaobjectDefinitionId,
      })
    }
  }
  return out
}

/** Check a definition's field list: unique keys, sensible rules, a real display field. */
export function definitionProblems(
  fields: readonly FieldDefinition[],
  displayNameKey: string | null | undefined,
): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  for (const f of fields) {
    if (seen.has(f.key)) problems.push(`Two fields use the key ${f.key}`)
    seen.add(f.key)
    if (f.list && NO_LIST_TYPES.includes(f.type)) problems.push(`${f.name} cannot be a list`)
    problems.push(...ruleProblems(f.name, f.type, f.validations))
  }
  if (displayNameKey && !fields.some((f) => f.key === displayNameKey)) {
    problems.push('The display name must be one of the fields')
  }
  return problems
}

/** Rules that contradict the type or each other. */
export function ruleProblems(
  name: string,
  type: FieldType,
  rules: FieldValidations | undefined,
): string[] {
  if (!rules) return []
  const problems: string[] = []
  const numeric = type === 'number_integer' || type === 'number_decimal'
  if (numeric && (typeof rules.min === 'string' || typeof rules.max === 'string')) {
    problems.push(`${name}: number limits must be numbers`)
  }
  if (type === 'date') {
    for (const bound of [rules.min, rules.max]) {
      if (bound !== undefined && (typeof bound !== 'string' || !isRealDate(bound))) {
        problems.push(`${name}: date limits must be dates`)
      }
    }
  }
  if (typeof rules.min === 'number' && typeof rules.max === 'number' && rules.min > rules.max) {
    problems.push(`${name}: make the minimum smaller than the maximum`)
  }
  if (
    rules.minLength !== undefined &&
    rules.maxLength !== undefined &&
    rules.minLength > rules.maxLength
  ) {
    problems.push(`${name}: make the minimum length smaller than the maximum`)
  }
  if (rules.choices?.length && type !== 'single_line_text') {
    problems.push(`${name}: only short text can have preset choices`)
  }
  if (rules.metaobjectDefinitionId && type !== 'metaobject_reference') {
    problems.push(`${name}: only an "Another entry" field can name a content type`)
  }
  if (type === 'metaobject_reference' && !rules.metaobjectDefinitionId) {
    problems.push(`${name}: pick which content type it links to`)
  }
  return problems
}

/** Name of an entry in lists and pickers: its display field, else its handle. */
export function entryDisplayName(
  displayNameKey: string | null | undefined,
  fields: Record<string, unknown>,
  handle: string,
): string {
  const v = displayNameKey ? fields[displayNameKey] : undefined
  if (typeof v === 'string' && v.trim()) return v.trim()
  if (typeof v === 'number') return String(v)
  return handle
}
