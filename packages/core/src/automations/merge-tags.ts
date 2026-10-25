/** SOURCE OF TRUTH: automation merge tags — WHAT: fills `{order.number}`-style dotted merge tags in action text from a run's subject data (money fields as ₹, lists joined), and lists the tags a template uses / WHY: the interpreter, the dry run and the editor's "unknown tag" check must render the same way. Single braces like Growth's `applyMergeTags`, no template logic. Pure, client-safe. Design §8.2. */
import { formatMoney } from '@commerce/money'
import { CONDITION_FIELDS } from './condition-fields'

const TAG = /\{([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+)\}/g

const MONEY_PATHS: ReadonlySet<string> = new Set(
  CONDITION_FIELDS.filter((f) => f.type === 'money').map((f) => f.path),
)

/** Reads a dotted path; through a list it collects every item's value. */
export function readPath(data: unknown, path: string): unknown {
  let cur: unknown = data
  for (const key of path.split('.')) {
    if (Array.isArray(cur)) {
      cur = cur.map((item) =>
        item && typeof item === 'object' ? (item as Record<string, unknown>)[key] : undefined,
      )
      continue
    }
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

function display(path: string, value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value))
    return value
      .map((v) => display(path, v))
      .filter(Boolean)
      .join(', ')
  if (typeof value === 'number' && MONEY_PATHS.has(path)) return formatMoney(value)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return ''
  return String(value)
}

/** `Order {order.number} for {order.total}` → `Order 1042 for ₹2,450.00`. Unknown tags render empty. */
export function renderMergeTags(template: string, data: Record<string, unknown>): string {
  return template.replace(TAG, (_whole, path: string) => display(path, readPath(data, path)))
}

/** The dotted tags a text uses, for the editor's check. */
export function mergeTagsIn(template: string): string[] {
  return [...new Set([...template.matchAll(TAG)].map((m) => m[1] as string))]
}
