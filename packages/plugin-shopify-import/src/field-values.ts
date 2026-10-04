/**
 * Shopify metafield and metaobject field types → our 12 field types, and
 * Shopify's stored values (always strings) → the values our validator takes.
 * Pure: references come back as Shopify ids for the caller to resolve.
 */
import {
  type FieldRule,
  type FieldType,
  type FieldValidations,
  keyFromName,
  NO_LIST_TYPES,
  type ReferenceType,
  validateFieldValue,
} from '@commerce/core/metaobjects'
import type { LeftBehindReason } from './client'
import { htmlToRichText, type RichText } from './html'
import type { NFieldDefinition, NFieldValue } from './types'

export type FieldMapping =
  | {
      ok: true
      type: FieldType
      list: boolean
      /** Set when the value arrives changed (date and time → date, link → address). */
      lossy?: Extract<LeftBehindReason, 'time_dropped' | 'link_label'> | undefined
    }
  | { ok: false; shopifyType: string }

const BASE_TYPES: Record<string, FieldType> = {
  single_line_text_field: 'single_line_text',
  multi_line_text_field: 'multi_line_text',
  rich_text_field: 'rich_text',
  number_integer: 'number_integer',
  number_decimal: 'number_decimal',
  boolean: 'boolean',
  date: 'date',
  date_time: 'date',
  url: 'url',
  link: 'url',
  color: 'single_line_text',
  id: 'single_line_text',
  file_reference: 'file',
  product_reference: 'product_reference',
  collection_reference: 'collection_reference',
  metaobject_reference: 'metaobject_reference',
}

/** `list.product_reference` → a list of product references; money, rating, JSON… → not supported. */
export function mapShopifyType(shopifyType: string): FieldMapping {
  const list = shopifyType.startsWith('list.')
  const base = list ? shopifyType.slice(5) : shopifyType
  const type = BASE_TYPES[base]
  if (!type || (list && NO_LIST_TYPES.includes(type))) return { ok: false, shopifyType }
  const lossy = base === 'date_time' ? 'time_dropped' : base === 'link' ? 'link_label' : undefined
  return { ok: true, type, list, ...(lossy ? { lossy } : {}) }
}

/** Shopify keys and namespaces allow `-` and capitals; ours are lower snake case. */
export const localKey = (shopifyKey: string): string => keyFromName(shopifyKey)

/** `size_guide` / `size-guide` → `Size guide`, for metafields Shopify has no definition for. */
export function nameFromKey(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim()
  return words ? words[0]?.toUpperCase() + words.slice(1) : key
}

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** The rules we keep from Shopify's validations: preset choices. Anything stricter is dropped. */
export function validationsFrom(
  def: Pick<NFieldDefinition, 'validations'>,
  type: FieldType,
): FieldValidations {
  const out: FieldValidations = {}
  if (type !== 'single_line_text') return out
  const choices = def.validations.find((v) => v.name === 'choices')?.value
  const parsed = choices ? parseJson(choices) : null
  if (Array.isArray(parsed)) {
    const list = parsed
      .filter((c): c is string => typeof c === 'string' && c.trim() !== '')
      .map((c) => c.trim().slice(0, 200))
    if (list.length) out.choices = [...new Set(list)].slice(0, 128)
  }
  return out
}

/** The Shopify metaobject definition a reference field points at, when it says. */
export function referenceTarget(def: Pick<NFieldDefinition, 'validations'>): string | null {
  return def.validations.find((v) => v.name === 'metaobject_definition_id')?.value ?? null
}

/* --------------------------------------------------------- Shopify rich text */

type RtNode = {
  type?: string
  value?: string
  bold?: boolean
  italic?: boolean
  level?: number
  listType?: string
  url?: string
  children?: RtNode[]
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function rtToHtml(node: RtNode): string {
  const inner = (node.children ?? []).map(rtToHtml).join('')
  switch (node.type) {
    case 'root':
      return inner
    case 'paragraph':
      return `<p>${inner}</p>`
    case 'heading': {
      const level = Math.min(6, Math.max(1, node.level ?? 2))
      return `<h${level}>${inner}</h${level}>`
    }
    case 'list':
      return node.listType === 'ordered' ? `<ol>${inner}</ol>` : `<ul>${inner}</ul>`
    case 'list-item':
      return `<li>${inner}</li>`
    case 'link':
      return `<a href="${escapeHtml(node.url ?? '')}">${inner}</a>`
    case 'text': {
      let text = escapeHtml(node.value ?? '').replace(/\n/g, '<br>')
      if (node.bold) text = `<strong>${text}</strong>`
      if (node.italic) text = `<em>${text}</em>`
      return text
    }
    default:
      return inner
  }
}

/** Shopify's rich text JSON → our rich text (Lexical), through the same HTML reader as page bodies. */
export function shopifyRichText(raw: string): RichText | null {
  const parsed = parseJson(raw) as RtNode | null
  if (!parsed || typeof parsed !== 'object') return null
  return htmlToRichText(rtToHtml(parsed)).doc
}

/* -------------------------------------------------------------- values */

/** A reference still to resolve: what kind of record and its Shopify id. */
export type PendingReference = { kind: ReferenceType; gid: string }

/**
 * One Shopify value in the shape our validator takes. References stay as their
 * Shopify ids (`gid://shopify/Product/1`) for `resolveValue` to swap.
 */
export function parseShopifyValue(
  mapping: Extract<FieldMapping, { ok: true }>,
  shopifyType: string,
  raw: string | null,
): unknown {
  if (raw === null || raw === '') return null
  const base = shopifyType.startsWith('list.') ? shopifyType.slice(5) : shopifyType
  const one = (v: unknown): unknown => {
    if (base === 'rich_text_field') return typeof v === 'string' ? shopifyRichText(v) : null
    if (base === 'date_time') return typeof v === 'string' ? v.slice(0, 10) : null
    if (base === 'link') {
      const link = (typeof v === 'string' ? parseJson(v) : v) as { url?: unknown } | null
      return typeof link?.url === 'string' ? link.url : null
    }
    if (base === 'boolean') return v === true || v === 'true'
    return typeof v === 'number' ? v : typeof v === 'string' ? v : null
  }
  if (!mapping.list) return one(raw)
  const items = parseJson(raw)
  return Array.isArray(items) ? items.map(one).filter((v) => v !== null) : null
}

const isGid = (v: unknown): v is string => typeof v === 'string' && v.startsWith('gid://')

/**
 * Swap Shopify ids for ours. `resolve` answers our id or null; unresolved
 * items are dropped from lists (a single reference becomes empty) and
 * reported through `missing`.
 */
async function resolveValue(
  mapping: Extract<FieldMapping, { ok: true }>,
  value: unknown,
  resolve: (ref: PendingReference) => Promise<string | null>,
  missing: (ref: PendingReference) => void,
): Promise<unknown> {
  const kind = mapping.type
  if (
    kind !== 'file' &&
    kind !== 'product_reference' &&
    kind !== 'collection_reference' &&
    kind !== 'metaobject_reference'
  ) {
    return value
  }
  const swap = async (v: unknown): Promise<string | null> => {
    if (!isGid(v)) return null
    const id = await resolve({ kind, gid: v })
    if (!id) missing({ kind, gid: v })
    return id
  }
  if (Array.isArray(value)) {
    const out: string[] = []
    for (const v of value) {
      const id = await swap(v)
      if (id) out.push(id)
    }
    return out
  }
  return swap(value)
}

/** How one Shopify field lands here: our key, the type mapping and our validation rule. */
export type FieldPlan = {
  localKey: string
  mapping: Extract<FieldMapping, { ok: true }>
  rule: FieldRule
}

const KIND_WORDS: Record<ReferenceType, string> = {
  file: 'a file',
  product_reference: 'a product',
  collection_reference: 'a collection',
  metaobject_reference: 'an entry',
}

export type ConvertedFields = {
  values: Record<string, unknown>
  /** One line per value that could not be kept, for the issue list. */
  problems: string[]
  /** Shopify types of values with no field here (counted as left behind). */
  unsupported: string[]
  /** Values that arrived changed (date and time → date…). */
  lossy: Extract<LeftBehindReason, 'time_dropped' | 'link_label'>[]
  /** Entry links that point at entries not written yet; worth a second pass. */
  deferred: boolean
}

/**
 * Shopify field values → our validated values, keyed by our field key. Each
 * value is parsed, its links swapped for our ids and validated on its own, so
 * one bad value never sinks the rest. With `deferEntries`, links to entries
 * not imported yet are left out quietly and `deferred` asks for another pass.
 */
export async function convertFields(
  plans: Map<string, FieldPlan>,
  values: readonly NFieldValue[],
  resolve: (ref: PendingReference) => Promise<string | null>,
  opts: { deferEntries: boolean },
): Promise<ConvertedFields> {
  const out: ConvertedFields = {
    values: {},
    problems: [],
    unsupported: [],
    lossy: [],
    deferred: false,
  }
  for (const field of values) {
    if (field.value === null || field.value === '') continue
    const plan = plans.get(field.key)
    if (!plan) {
      out.unsupported.push(field.type)
      continue
    }
    const parsed = parseShopifyValue(plan.mapping, field.type, field.value)
    const resolved = await resolveValue(plan.mapping, parsed, resolve, (ref) => {
      if (opts.deferEntries && ref.kind === 'metaobject_reference') out.deferred = true
      else
        out.problems.push(
          `${plan.rule.name}: links to ${KIND_WORDS[ref.kind]} that was not imported (${ref.gid})`,
        )
    })
    const checked = validateFieldValue({ ...plan.rule, required: false }, resolved)
    if (!checked.ok) {
      out.problems.push(checked.error)
      continue
    }
    if (checked.value === null) continue
    if (plan.mapping.lossy) out.lossy.push(plan.mapping.lossy)
    out.values[plan.localKey] = checked.value
  }
  return out
}
