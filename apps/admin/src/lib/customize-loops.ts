import {
  isCompatible,
  LOOP_PRODUCT_FIELDS,
  type LoopSpec,
  type LoopValues,
  loopKey,
  parseLoopSource,
  type SettingKind,
  type SourceType,
} from '@commerce/core/dynamic-sources'
import { api } from '@/lib/api-client'
import type { FieldLike } from './customize-field-shape'
import { settingKindOf } from './dynamic-sources'

/**
 * Admin side of lists bound to store data ("Use content from…" on a repeatable field). The
 * format and every rule live in `@commerce/core/dynamic-sources` (`loops.ts`); this file only
 * reads the editor's fields, fetches the catalog and preview rows, and guesses a first map.
 */

export type LoopCatalog = Awaited<ReturnType<typeof api.themes.templates.loopSources>>

/** One readable field of a list's source: an entry field, or a product field. */
export type LoopSourceField = { key: string; name: string; type: SourceType }

/** Each item field that can take a value from a list, and the kind of setting it is. */
export function itemKinds(arrayFields: Record<string, FieldLike>): Record<string, SettingKind> {
  const out: Record<string, SettingKind> = {}
  for (const [name, field] of Object.entries(arrayFields)) {
    const kind = settingKindOf(field, name)
    if (kind) out[name] = kind
  }
  return out
}

/** The fields a source offers, with the names the merchant gave them (product fields by key). */
export function sourceFields(
  source: string,
  catalog: LoopCatalog | null,
  productNames: Record<keyof typeof LOOP_PRODUCT_FIELDS, string>,
): LoopSourceField[] {
  const parsed = parseLoopSource(source)
  if (!parsed) return []
  if (parsed.scope === 'collection_products') {
    return (Object.keys(LOOP_PRODUCT_FIELDS) as (keyof typeof LOOP_PRODUCT_FIELDS)[]).map(
      (key) => ({ key, name: productNames[key], type: LOOP_PRODUCT_FIELDS[key] }),
    )
  }
  const type = catalog?.types.find((t) => t.type === parsed.type)
  return type ? type.fields : []
}

/** Words that mean the same thing across sections and content types, for the first guess. */
const ALIKE: Record<string, string[]> = {
  title: ['title', 'name', 'heading', 'question', 'label', 'author', 'caption'],
  text: ['text', 'body', 'answer', 'quote', 'description', 'bio', 'detail', 'excerpt'],
  image: ['image', 'photo', 'logo', 'picture', 'featured_image', 'avatar'],
  link: ['link', 'href', 'url', 'button'],
}

const groupOf = (key: string) =>
  Object.entries(ALIKE).find(([, words]) => words.includes(key.toLowerCase()))?.[0]

/**
 * A first map from item fields to source fields: the same name first, then a field of the same
 * meaning ("question" for a heading, "photo" for an image), always of a compatible type, each
 * source field used once. The merchant can change any of it in the dialog.
 */
export function guessMap(
  kinds: Record<string, SettingKind>,
  fields: readonly LoopSourceField[],
): LoopSpec['map'] {
  const map: LoopSpec['map'] = {}
  const used = new Set<string>()
  const fits = (kind: SettingKind) => (f: LoopSourceField) =>
    !used.has(f.key) && isCompatible(kind, f.type)
  for (const [name, kind] of Object.entries(kinds)) {
    const same = fields.filter(fits(kind)).find((f) => f.key === name)
    const alike =
      same ??
      fields.filter(fits(kind)).find((f) => groupOf(f.key) && groupOf(f.key) === groupOf(name))
    if (alike) {
      map[name] = { from: alike.key, kind }
      used.add(alike.key)
    }
  }
  return map
}

let catalog: Promise<LoopCatalog> | null = null

/** Content types and collections a list can read, fetched once per editor session. */
export function loadLoopCatalog(): Promise<LoopCatalog> {
  catalog ??= api.themes.templates.loopSources().catch((err: unknown) => {
    catalog = null
    throw err
  })
  return catalog
}

const rows = new Map<string, Promise<LoopValues>>()

/** Preview rows for the given lists, cached per source and limit for the editor session. */
export async function loadLoopRows(loops: readonly LoopSpec[]): Promise<LoopValues> {
  const missing = loops.filter((l) => !rows.has(loopKey(l)))
  if (missing.length) {
    const batch = api.themes.templates
      .loopValues({ loops: missing })
      .catch(() => ({}) as LoopValues)
    for (const l of missing) rows.set(loopKey(l), batch)
  }
  const out: LoopValues = {}
  for (const l of loops) {
    const got = (await rows.get(loopKey(l)))?.[loopKey(l)]
    if (got) out[loopKey(l)] = got
  }
  return out
}
