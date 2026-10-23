/** SOURCE OF TRUTH: automation condition evaluator — WHAT: decides an AND/OR rule group over a run's subject data (typed operators per field type, any/all/none over line items and tag lists, money in paise, calendar dates in the store's time zone) and traces every rule for the run log / WHY: the worker's interpreter and the editor's "Test with a record" must branch the same way on the same data. Pure, no database. Design §8.2. */
import { type FieldType, OPERATORS_BY_TYPE } from '../catalogue'
import { CONDITION_FIELDS } from '../condition-fields'
import { isRuleGroup, type Rule, type RuleGroup, type RuleQuantifier } from '../definition'
import type { ConditionResult, RuleTrace, SubjectData } from '../executor'

/** Field types by path; paths outside the catalogue (plugin `trigger.*` data) are inferred. */
const FIELD_TYPE = new Map(CONDITION_FIELDS.map((f) => [f.path, f]))

/** Stores without a time zone of their own are in India. */
export const DEFAULT_TIME_ZONE = 'Asia/Kolkata'

export type EvaluateOptions = {
  /** "Within the last N days" counts back from here; tests pin it. */
  now?: Date | undefined
  /** Calendar dates (`2026-10-23`) start at midnight here. Defaults to `data.store.timezone`. */
  timeZone?: string | undefined
}

/** Reads a dotted path; through a list it collects every item's value (one entry per item). */
export function readPath(data: unknown, path: string): { value: unknown; list: boolean } {
  let cur: unknown = data
  let list = false
  for (const key of path.split('.')) {
    if (Array.isArray(cur)) {
      list = true
      cur = cur.map((item) => (isObject(item) ? item[key] : undefined))
      continue
    }
    if (!isObject(cur)) return { value: undefined, list }
    cur = cur[key]
  }
  return { value: cur, list }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// ---------------------------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------------------------

const norm = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim())
const lower = (v: unknown): string => norm(v).toLowerCase()

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim())
    return Number.isFinite(n) ? n : null
  }
  return null
}

const asList = (v: unknown): unknown[] =>
  Array.isArray(v) ? v : v === null || v === undefined || v === '' ? [] : [v]

/** Offset of `timeZone` from UTC at `at`, in ms (IST is +5:30). */
function zoneOffsetMs(timeZone: string, at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(at))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  return asUtc - Math.floor(at / 60_000) * 60_000
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/** Midnight starting the calendar day `y-m-d` in `timeZone`, as epoch ms. */
function zonedMidnight(y: number, m: number, d: number, timeZone: string): number {
  const guess = Date.UTC(y, m - 1, d)
  const first = guess - zoneOffsetMs(timeZone, guess)
  // Second pass settles days where the offset changes (DST zones).
  return guess - zoneOffsetMs(timeZone, first)
}

/**
 * A rule's date as the instant it starts, plus the start of the next day for calendar dates
 * ("after 23 Oct" means from 24 Oct, midnight in the store's zone).
 */
function ruleDate(v: unknown, timeZone: string): { start: number; end: number } | null {
  const s = norm(v)
  const m = DATE_ONLY.exec(s)
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const start = zonedMidnight(y, mo, d, timeZone)
    return { start, end: zonedMidnight(y, mo, d + 1, timeZone) }
  }
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : { start: t, end: t }
}

function actualDate(v: unknown): number | null {
  if (v instanceof Date) return v.getTime()
  if (typeof v !== 'string' || !v) return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : t
}

// ---------------------------------------------------------------------------------------------
// Operators: one actual value (one line item's, or the field's) against the rule's value
// ---------------------------------------------------------------------------------------------

type Ctx = { now: number; timeZone: string }

function compareNumber(op: Rule['op'], actual: unknown, expected: unknown): boolean {
  const a = toNumber(actual)
  const e = toNumber(expected)
  if (op === 'neq') return a === null || e === null || a !== e
  if (a === null || e === null) return false
  switch (op) {
    case 'eq':
      return a === e
    case 'gt':
      return a > e
    case 'gte':
      return a >= e
    case 'lt':
      return a < e
    case 'lte':
      return a <= e
    default:
      return false
  }
}

function compareText(op: Rule['op'], actual: unknown, expected: unknown): boolean {
  const a = lower(actual)
  const e = lower(expected)
  switch (op) {
    case 'eq':
      return a === e
    case 'neq':
      return a !== e
    case 'contains':
      return e !== '' && a.includes(e)
    case 'not_contains':
      return e === '' || !a.includes(e)
    case 'starts_with':
      return e !== '' && a.startsWith(e)
    case 'is_empty':
      return a === ''
    case 'is_not_empty':
      return a !== ''
    default:
      return false
  }
}

/**
 * Tags: `includes` holds when the tags include the rule's tag(s) — any one of them by
 * default, every one with `all` — and `not_includes` when none of them is there. Matching
 * ignores case, as the tag editors do.
 */
function compareTags(
  op: Rule['op'],
  actual: unknown,
  expected: unknown,
  quantifier: RuleQuantifier,
): boolean {
  const have = new Set(asList(actual).map(lower).filter(Boolean))
  if (op === 'is_empty') return have.size === 0
  if (op === 'is_not_empty') return have.size > 0
  const wanted = asList(expected).map(lower).filter(Boolean)
  if (wanted.length === 0) return false
  if (op === 'includes') {
    if (quantifier === 'all') return wanted.every((t) => have.has(t))
    if (quantifier === 'none') return !wanted.some((t) => have.has(t))
    return wanted.some((t) => have.has(t))
  }
  if (op === 'not_includes') return !wanted.some((t) => have.has(t))
  return false
}

function compareBoolean(op: Rule['op'], actual: unknown): boolean {
  const a = actual === true || actual === 'true'
  if (op === 'is_true') return a
  if (op === 'is_false') return !a
  return false
}

function compareDate(op: Rule['op'], actual: unknown, expected: unknown, ctx: Ctx): boolean {
  const a = actualDate(actual)
  if (a === null) return false
  if (op === 'within_last_days') {
    const days = toNumber(expected)
    if (days === null || days < 0) return false
    return a <= ctx.now && a >= ctx.now - days * 86_400_000
  }
  const e = ruleDate(expected, ctx.timeZone)
  if (!e) return false
  if (op === 'before') return a < e.start
  if (op === 'after') return a >= e.end
  return false
}

function compareEnum(op: Rule['op'], actual: unknown, expected: unknown): boolean {
  const a = norm(actual)
  if (op === 'is_one_of') return asList(expected).map(norm).includes(a)
  if (op === 'eq') return a === norm(expected)
  if (op === 'neq') return a !== norm(expected)
  return false
}

function compareOne(
  type: FieldType,
  rule: Rule,
  actual: unknown,
  quantifier: RuleQuantifier,
  ctx: Ctx,
): boolean {
  switch (type) {
    case 'number':
    case 'money':
      return compareNumber(rule.op, actual, rule.value)
    case 'text':
      return compareText(rule.op, actual, rule.value)
    case 'tags':
      return compareTags(rule.op, actual, rule.value, quantifier)
    case 'boolean':
      return compareBoolean(rule.op, actual)
    case 'date':
      return compareDate(rule.op, actual, rule.value, ctx)
    case 'enum':
      return compareEnum(rule.op, actual, rule.value)
  }
}

/** A field outside the catalogue (plugin trigger data): its type from the operator and value. */
function inferType(rule: Rule, actual: unknown): FieldType {
  const fits = (t: FieldType) => OPERATORS_BY_TYPE[t].includes(rule.op)
  if (fits('date') && !fits('text')) return 'date'
  if (fits('boolean')) return 'boolean'
  if (rule.op === 'is_one_of') return 'enum'
  if (rule.op === 'includes' || rule.op === 'not_includes' || Array.isArray(actual)) return 'tags'
  if (typeof actual === 'number' && fits('number')) return 'number'
  return 'text'
}

/**
 * One rule. On a list field (line items) the quantifier says whether it must hold for any
 * line (the default), all lines or none; `all` over no lines does not hold, `none` does.
 */
function evaluateRule(rule: Rule, data: SubjectData, ctx: Ctx): RuleTrace {
  const { value, list } = readPath(data, rule.field)
  const descriptor = FIELD_TYPE.get(rule.field)
  const type = descriptor?.type ?? inferType(rule, value)
  const quantifier = rule.quantifier ?? 'any'
  const expected = rule.value
  const allowed = OPERATORS_BY_TYPE[type].includes(rule.op)
  let pass = false
  if (allowed) {
    if (descriptor?.list || (list && type !== 'tags')) {
      const items = asList(value)
      // A list of tag lists (line items' product tags): the quantifier picks the lines.
      const one = (item: unknown) => compareOne(type, rule, item, 'any', ctx)
      if (quantifier === 'all') pass = items.length > 0 && items.every(one)
      else if (quantifier === 'none') pass = !items.some(one)
      else pass = items.some(one)
    } else {
      pass = compareOne(type, rule, value, quantifier, ctx)
    }
  }
  return { field: rule.field, op: rule.op, expected, actual: value ?? null, pass }
}

function evaluateGroup(group: RuleGroup, data: SubjectData, ctx: Ctx, trace: RuleTrace[]): boolean {
  // Every rule is traced (no short circuit), so the run log explains the whole check.
  const results = group.rules.map((r): boolean => {
    if (isRuleGroup(r)) return evaluateGroup(r, data, ctx, trace)
    const t = evaluateRule(r, data, ctx)
    trace.push(t)
    return t.pass
  })
  if (results.length === 0) return true
  return group.join === 'and' ? results.every(Boolean) : results.some(Boolean)
}

/** Evaluates a rule group; `opts` pins the clock and time zone (tests, previews). */
export function evaluateRulesAt(
  rules: RuleGroup,
  data: SubjectData,
  opts: EvaluateOptions = {},
): ConditionResult {
  const store = isObject(data.store) ? data.store : null
  const timeZone =
    opts.timeZone ?? (typeof store?.timezone === 'string' ? store.timezone : DEFAULT_TIME_ZONE)
  const ctx: Ctx = { now: (opts.now ?? new Date()).getTime(), timeZone }
  const trace: RuleTrace[] = []
  const pass = evaluateGroup(rules, data, ctx, trace)
  return { pass, trace }
}
