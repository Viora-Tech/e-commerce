import type { SourceOption } from '@commerce/core/dynamic-sources'

/**
 * How "Connect dynamic source" lays out the catalog: one section per source type
 * (Product, Collection, Store, then each content type), and inside a content type
 * one row per entry with its fields beside it. Pure, so the picker only renders.
 */

export type SourceSectionKind = 'product' | 'collection' | 'shop' | 'metaobject'

/** One pickable source: what gets inserted (`path`) and what the row reads. */
export type SourceRow = { path: string; label: string }

/** A content type entry ("Large") and the fields of it that fit the setting. */
export type SourceEntry = { key: string; name: string; fields: SourceRow[] }

export type SourceSection = {
  key: string
  kind: SourceSectionKind
  title: string
  /** Product, collection and store fields. Empty for content types. */
  rows: SourceRow[]
  /** Content type entries. Empty for the other kinds. */
  entries: SourceEntry[]
}

export type SourceSectionTitles = Record<Exclude<SourceSectionKind, 'metaobject'>, string>

const KIND: Record<SourceOption['group'], SourceSectionKind> = {
  product: 'product',
  product_metafields: 'product',
  collection: 'collection',
  collection_metafields: 'collection',
  shop: 'shop',
  metaobject: 'metaobject',
}

const has = (text: string, q: string) => text.toLowerCase().includes(q)

/**
 * Sections in catalog order. With a `query`, a section whose title matches keeps
 * everything, an entry whose name matches keeps all its fields, otherwise only
 * matching fields stay; empty sections and entries drop out.
 */
export function groupSources(
  options: readonly SourceOption[],
  labelOf: (option: SourceOption) => string,
  titles: SourceSectionTitles,
  query = '',
): SourceSection[] {
  const sections = new Map<string, SourceSection>()
  for (const option of options) {
    const kind = KIND[option.group]
    const [, type = '', handle = ''] = option.path.split('.')
    const key = kind === 'metaobject' ? `metaobject:${type}` : kind
    let section = sections.get(key)
    if (!section) {
      const title = kind === 'metaobject' ? option.definition || type : titles[kind]
      section = { key, kind, title, rows: [], entries: [] }
      sections.set(key, section)
    }
    const row = { path: option.path, label: labelOf(option) }
    if (kind !== 'metaobject') {
      section.rows.push(row)
      continue
    }
    const entry = section.entries.find((e) => e.key === handle)
    if (entry) entry.fields.push(row)
    else section.entries.push({ key: handle, name: option.entry || handle, fields: [row] })
  }

  const q = query.trim().toLowerCase()
  if (!q) return [...sections.values()]
  const out: SourceSection[] = []
  for (const section of sections.values()) {
    if (has(section.title, q)) {
      out.push(section)
      continue
    }
    const rows = section.rows.filter((r) => has(r.label, q))
    const entries = section.entries.flatMap((e) => {
      if (has(e.name, q)) return [e]
      const fields = e.fields.filter((f) => has(f.label, q))
      return fields.length ? [{ ...e, fields }] : []
    })
    if (rows.length || entries.length) out.push({ ...section, rows, entries })
  }
  return out
}

/** Every path a section offers, in the order it shows them. */
export const sectionPaths = (section: SourceSection): string[] => [
  ...section.rows.map((r) => r.path),
  ...section.entries.flatMap((e) => e.fields.map((f) => f.path)),
]

/** How many sources a section holds, for its header count. */
export const sectionSize = (section: SourceSection): number => sectionPaths(section).length

/**
 * Whether a section starts open: the page's own product or collection and the
 * store always do, a content type only when it holds the connected source or is
 * the only thing to pick from.
 */
export function startsOpen(
  section: SourceSection,
  current: string | null,
  sectionCount: number,
): boolean {
  if (section.kind !== 'metaobject' || sectionCount === 1) return true
  return current !== null && sectionPaths(section).includes(current)
}

/** `text` split around each case-insensitive match of `query`, for highlighting. */
export function splitMatch(text: string, query: string): { text: string; match: boolean }[] {
  const q = query.trim().toLowerCase()
  if (!q) return [{ text, match: false }]
  const parts: { text: string; match: boolean }[] = []
  const lower = text.toLowerCase()
  let from = 0
  for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, from)) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false })
    parts.push({ text: text.slice(at, at + q.length), match: true })
    from = at + q.length
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false })
  return parts
}
