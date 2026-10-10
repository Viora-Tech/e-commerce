/** SOURCE OF TRUTH: list bindings (loops) — WHAT the `{ $loop: { source, limit, map }, fallback }` format a section's repeatable field (FAQ items, quotes, logos, people, photos) stores to fill its rows from store data, how a template's loops are found, and how loaded rows replace them / WHY the editor, Save and the storefront renderer must read loops the same way. No database (loading: `./loop-service.ts`). */
import { isPlainData, isSettingKind, type SettingKind, type SourceType } from './format'
import { coerceSourceValue } from './resolve'

/**
 * A loop fills an `array` field from a list in the store instead of rows typed in the editor:
 *
 *   { "$loop": { "source": "metaobject:faq", "limit": 6,
 *                "map": { "question": { "from": "question", "kind": "text" },
 *                         "answer":   { "from": "answer",   "kind": "richtext" } } },
 *     "fallback": [ ...the rows that were there before linking... ] }
 *
 * `source` is `metaobject:<type>` (active entries of a storefront-visible content type, oldest
 * first) or `collection:<handle>.products` (the collection's products in its own order).
 * `map` says which field of each row reads which field of each entry or product, and what kind
 * of setting it is (so a price reads as text, a file as an image). `fallback` renders whenever
 * the list is empty or cannot be read, and is what the array goes back to on "Unlink".
 */
export type LoopSpec = {
  source: string
  limit: number
  map: Record<string, { from: string; kind: SettingKind }>
}

export type LoopBinding = { $loop: LoopSpec; fallback?: unknown[] | undefined }

/** Rows a loop may draw at most, whatever it asks for. */
export const LOOP_MAX = 50

export type LoopSource =
  | { scope: 'metaobject'; type: string }
  | { scope: 'collection_products'; handle: string }

const KEY = /^[a-z][a-z0-9_]{0,63}$/
const HANDLE = /^[a-z0-9][a-z0-9-]{0,199}$/

/** Product fields a collection loop can map, with the type each holds. */
export const LOOP_PRODUCT_FIELDS = {
  title: 'single_line_text',
  price: 'money',
  compare_at_price: 'money',
  vendor: 'single_line_text',
  type: 'single_line_text',
  featured_image: 'file',
  url: 'url',
} as const satisfies Record<string, SourceType>

export function isLoop(value: unknown): value is LoopBinding {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const loop = (value as { $loop?: unknown }).$loop
  return typeof loop === 'object' && loop !== null && typeof (loop as LoopSpec).source === 'string'
}

/** Parse a loop source, or null when it is not one we know how to read. */
export function parseLoopSource(source: string): LoopSource | null {
  if (typeof source !== 'string' || source.length > 260) return null
  if (source.startsWith('metaobject:')) {
    const type = source.slice('metaobject:'.length)
    return KEY.test(type) ? { scope: 'metaobject', type } : null
  }
  const m = /^collection:(.+)\.products$/.exec(source)
  if (m?.[1] && HANDLE.test(m[1])) return { scope: 'collection_products', handle: m[1] }
  return null
}

/** The number of rows a loop draws: its own limit, at least 1, at most `LOOP_MAX`. */
export const loopLimit = (spec: Pick<LoopSpec, 'limit'>): number =>
  Math.max(1, Math.min(LOOP_MAX, Math.floor(Number(spec.limit) || LOOP_MAX)))

/** A loop for `source`, keeping the rows typed in so far as its fallback. */
export function linkLoop(
  source: string,
  limit: number,
  map: LoopSpec['map'],
  current: unknown,
): LoopBinding {
  const fallback = isLoop(current) ? current.fallback : Array.isArray(current) ? current : []
  return { $loop: { source, limit: loopLimit({ limit }), map }, fallback: fallback ?? [] }
}

/** Unlinking puts the typed-in rows back. */
export const unlinkLoop = (loop: LoopBinding): unknown[] => loop.fallback ?? []

/** The key a loaded list is stored under: the same source and limit load once per request. */
export const loopKey = (spec: Pick<LoopSpec, 'source' | 'limit'>): string =>
  `${spec.source}#${loopLimit(spec)}`

/**
 * One loaded row of a list: each field's value with its type, keyed by the field it was read
 * from (an entry's field key, or a product field such as `price`).
 */
export type LoopRow = Record<string, { type: SourceType; value: unknown }>

/** Loaded lists by `loopKey`. A loop whose key is missing renders its fallback. */
export type LoopValues = Record<string, LoopRow[]>

type DataLike = {
  root?: { props?: Record<string, unknown> | undefined } | undefined
  content?: readonly { type: string; props: Record<string, unknown> }[] | undefined
  zones?: Record<string, unknown> | undefined
}

function collect(value: unknown, out: LoopSpec[], seen: WeakSet<object>) {
  if (isLoop(value)) {
    out.push(value.$loop)
    return
  }
  if (typeof value !== 'object' || value === null) return
  if (seen.has(value) || !isPlainData(value)) return
  seen.add(value)
  for (const v of Array.isArray(value) ? value : Object.values(value)) collect(v, out, seen)
}

/** Every loop in a template (root, sections, nested zones and slots), distinct by `loopKey`. */
export function boundLoops(data: DataLike): LoopSpec[] {
  const out: LoopSpec[] = []
  const seen = new WeakSet<object>()
  collect(data.root?.props ?? {}, out, seen)
  for (const item of data.content ?? []) collect(item.props, out, seen)
  collect(data.zones ?? {}, out, seen)
  const byKey = new Map<string, LoopSpec>()
  for (const spec of out) {
    if (parseLoopSource(spec.source)) byKey.set(loopKey(spec), spec)
  }
  return [...byKey.values()]
}

/** One loaded row in the shape the section's array item expects; unmapped or empty fields are left out. */
function rowItem(spec: LoopSpec, row: LoopRow): Record<string, unknown> {
  const item: Record<string, unknown> = {}
  for (const [field, { from, kind }] of Object.entries(spec.map ?? {})) {
    const loaded = row[from]
    if (!loaded || !isSettingKind(kind)) continue
    const value = coerceSourceValue(kind, loaded.type, loaded.value)
    if (value !== undefined) item[field] = value
  }
  return item
}

function replaceLoops(value: unknown, values: LoopValues, seen: WeakSet<object>): unknown {
  if (isLoop(value)) {
    const rows = values[loopKey(value.$loop)]
    const fallback = Array.isArray(value.fallback) ? value.fallback : []
    if (!rows?.length) return fallback
    // A row takes the first fallback row's other settings (an icon, a rating) so the section's
    // own defaults for unmapped fields still show.
    const base = (fallback[0] && typeof fallback[0] === 'object' ? fallback[0] : {}) as object
    return rows.slice(0, loopLimit(value.$loop)).map((row) => ({
      ...base,
      ...rowItem(value.$loop, row),
    }))
  }
  if (typeof value !== 'object' || value === null) return value
  if (seen.has(value) || !isPlainData(value)) return value
  seen.add(value)
  if (Array.isArray(value)) return value.map((v) => replaceLoops(v, values, seen))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) out[k] = replaceLoops(v, values, seen)
  return out
}

/**
 * Template data with every loop swapped for its loaded rows, or its fallback rows when the list
 * is empty or was not loaded. Pass no values to get the fallbacks only (the editor before it
 * loads, code that cannot reach the store).
 */
export function applyLoops<T>(data: T, values: LoopValues = {}): T {
  return replaceLoops(data, values, new WeakSet()) as T
}

/**
 * Why a template's loops cannot be saved; empty when they can. With `types` (the content
 * types this store shows on its storefront), a metaobject loop must name one of them.
 */
export function loopProblems(data: DataLike, types?: ReadonlySet<string>): string[] {
  const problems: string[] = []
  const all: LoopSpec[] = []
  const seen = new WeakSet<object>()
  collect(data.root?.props ?? {}, all, seen)
  for (const item of data.content ?? []) collect(item.props, all, seen)
  collect(data.zones ?? {}, all, seen)
  for (const spec of all) {
    const parsed = parseLoopSource(spec.source)
    if (!parsed) {
      problems.push(`A list reads an unknown source (${String(spec.source)})`)
      continue
    }
    if (parsed.scope === 'metaobject' && types && !types.has(parsed.type)) {
      problems.push(`A list reads the content type "${parsed.type}", which no longer exists`)
    }
    for (const [field, m] of Object.entries(spec.map ?? {})) {
      if (!m || typeof m.from !== 'string' || !isSettingKind(m.kind)) {
        problems.push(`A list maps "${field}" in a way that cannot be read`)
      }
    }
  }
  return problems
}
