/**
 * Words for Automations pieces: a trigger, action, field or option by its catalogue copy key
 * (built-ins) or its own `label` (plugin pieces), plus durations, merge tags and the one-line
 * summary each canvas card shows. Pure; the copy objects come from `useCopy`.
 */
import type {
  ActionView,
  ConditionFieldDescriptor,
  FieldSpec,
  PieceText,
  Rule,
  RuleGroup,
  TriggerView,
  WorkflowNode,
} from '@commerce/core/automations'
import type { automationEditorContent } from '@/data/automations'
import type { Locale } from '@/lib/i18n'

type Pieces = Record<string, string>

/** The last segment of an id, readable: `order.add_tags` → "add tags". */
const humanise = (id: string) => (id.split(/[./]/).pop() ?? id).replace(/[_-]/g, ' ')

export function pieceText(
  pieces: Pieces,
  locale: Locale,
  key: string | undefined,
  label: PieceText | undefined,
  fallback: string,
): string {
  if (key && pieces[key]) return pieces[key]
  if (label) return (locale === 'hi' ? label.hi : undefined) ?? label.en
  return humanise(fallback)
}

export const triggerLabel = (pieces: Pieces, locale: Locale, t: TriggerView | null, id: string) =>
  pieceText(pieces, locale, t?.labelKey ?? `automations.trigger.${id}`, t?.label, id)

export const actionLabel = (pieces: Pieces, locale: Locale, a: ActionView | null, id: string) =>
  pieceText(pieces, locale, a?.labelKey ?? `automations.action.${id}`, a?.label, id)

export const fieldLabel = (pieces: Pieces, locale: Locale, f: FieldSpec) =>
  pieceText(pieces, locale, f.labelKey, f.label, f.key)

export const conditionFieldLabel = (
  pieces: Pieces,
  field: ConditionFieldDescriptor | undefined,
  path: string,
) => (field && pieces[field.labelKey]) || humanise(path)

/** An enum option of a condition field (`automations.enum.order.financial_status.paid`). */
export const enumLabel = (pieces: Pieces, path: string, value: string) =>
  pieces[`automations.enum.${path}.${value}`] ?? humanise(value)

/** Minutes as the biggest whole unit: 2880 → { 2, 'days' }. */
export function splitMinutes(minutes: number): {
  value: number
  unit: 'minutes' | 'hours' | 'days'
} {
  if (minutes % 1440 === 0) return { value: minutes / 1440, unit: 'days' }
  if (minutes % 60 === 0) return { value: minutes / 60, unit: 'hours' }
  return { value: minutes, unit: 'minutes' }
}

export const UNIT_MINUTES = { minutes: 1, hours: 60, days: 1440 } as const

export function durationText(
  minutes: number,
  units: (typeof automationEditorContent)['panel']['units'],
): string {
  const { value, unit } = splitMinutes(minutes)
  return `${value} ${units[unit]}`
}

/** Rules in a group, nested ones included. */
export function countRules(group: RuleGroup): number {
  return group.rules.reduce((n, r) => n + ('join' in r ? countRules(r) : 1), 0)
}

function ruleText(
  rule: Rule,
  pieces: Pieces,
  fields: ConditionFieldDescriptor[],
  ops: Record<string, string>,
): string {
  const field = fields.find((f) => f.path === rule.field)
  const name = conditionFieldLabel(pieces, field, rule.field)
  const op = ops[rule.op] ?? rule.op
  const value = Array.isArray(rule.value)
    ? rule.value.join(', ')
    : field?.type === 'money' && typeof rule.value === 'number'
      ? `₹${(rule.value / 100).toLocaleString('en-IN')}`
      : rule.value === undefined
        ? ''
        : String(rule.value)
  return [name, op, value].filter(Boolean).join(' ')
}

/** "Order total is at least ₹5,000" for one rule, "3 rules" for more. */
export function conditionSummary(
  group: RuleGroup,
  pieces: Pieces,
  fields: ConditionFieldDescriptor[],
  copy: (typeof automationEditorContent)['condition'],
): string | null {
  const total = countRules(group)
  if (total === 0) return null
  const first = group.rules[0]
  if (total === 1 && first && !('join' in first)) return ruleText(first, pieces, fields, copy.ops)
  return copy.summary(total)
}

/** The second line of an action card: its tags, note or address, when it has one. */
export function actionDetail(node: Extract<WorkflowNode, { kind: 'action' }>): string | null {
  const c = node.config
  if (Array.isArray(c.tags) && c.tags.length > 0) return c.tags.join(', ')
  for (const key of ['note', 'subject', 'url', 'reason']) {
    const v = c[key]
    if (typeof v === 'string' && v.trim()) return v
  }
  if (Array.isArray(c.to) && c.to.length > 0) return c.to.join(', ')
  return null
}

/** Merge tags a subject offers in template text (`{order.number}`). */
export function mergeTagsFor(subject: string, fields: ConditionFieldDescriptor[]): string[] {
  const extra: Record<string, string[]> = {
    order: [
      'order.number',
      'order.total',
      'customer.first_name',
      'customer.name',
      'customer.email',
    ],
    customer: ['customer.first_name', 'customer.name', 'customer.email'],
    product: ['product.title', 'product.total_stock', 'product.price'],
    cart: ['cart.total', 'customer.first_name', 'customer.name'],
    none: ['store.name'],
  }
  const fromFields = fields.filter((f) => f.subject === subject && !f.list).map((f) => f.path)
  return [...new Set([...(extra[subject] ?? []), ...fromFields, 'store.name'])]
}

const TAG = /\{([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*)\}/g

/** Merge tags in `text` the subject does not know (secrets are always allowed). */
export function unknownMergeTags(text: string, known: string[]): string[] {
  const out: string[] = []
  for (const m of text.matchAll(TAG)) {
    const tag = m[1] as string
    if (!tag.startsWith('secrets.') && !known.includes(tag) && !out.includes(tag)) out.push(tag)
  }
  return out
}
