/** SOURCE OF TRUTH: dynamic source catalog — WHAT every source a template can connect to (product, collection, store, metaobject fields) and which of them fit a setting / WHY the editor's picker and Save's check must list exactly the same sources. No database. */
import {
  COLLECTION_SOURCE_FIELDS,
  COMPATIBLE,
  isCompatible,
  PRODUCT_SOURCE_FIELDS,
  SETTING_KINDS,
  type SettingKind,
  SHOP_SOURCE_FIELDS,
  type SourceOption,
  type SourceType,
  scopeAllowed,
} from './format'

/** A product or collection metafield definition, as the catalog needs it. */
export type CatalogMetafield = {
  namespace: string
  key: string
  name: string
  type: SourceType
  list: boolean
}

/** A metaobject definition with its active entries. */
export type CatalogMetaobject = {
  type: string
  name: string
  fields: { key: string; name: string; type: SourceType; list: boolean }[]
  entries: { handle: string; displayName: string }[]
}

export type CatalogInput = {
  productMetafields: readonly CatalogMetafield[]
  collectionMetafields: readonly CatalogMetafield[]
  metaobjects: readonly CatalogMetaobject[]
}

/** Connectable at all: a single value some setting kind can show. */
const usable = (type: SourceType, list: boolean) =>
  !list && SETTING_KINDS.some((kind) => isCompatible(kind, type))

const fixed = (
  prefix: string,
  table: Record<string, SourceType>,
  group: SourceOption['group'],
): SourceOption[] =>
  Object.entries(table).map(([field, type]) => ({ path: `${prefix}.${field}`, type, group }))

const metafields = (
  prefix: 'product' | 'collection',
  defs: readonly CatalogMetafield[],
): SourceOption[] =>
  defs
    .filter((d) => usable(d.type, d.list))
    .map((d) => ({
      path: `${prefix}.metafields.${d.namespace}.${d.key}`,
      type: d.type,
      group: `${prefix}_metafields` as const,
      label: d.name,
    }))

/**
 * Every source a template can connect to, in picker order: the page's own
 * product or collection (fields, then metafields), the store, then each
 * metaobject entry's fields. List metafields and types no setting can show
 * (true/false, metaobject references) are left out.
 */
export function buildSourceCatalog(template: string, input: CatalogInput): SourceOption[] {
  const out: SourceOption[] = []
  if (scopeAllowed(template, 'product')) {
    out.push(...fixed('product', PRODUCT_SOURCE_FIELDS, 'product'))
    out.push(...metafields('product', input.productMetafields))
  }
  if (scopeAllowed(template, 'collection')) {
    out.push(...fixed('collection', COLLECTION_SOURCE_FIELDS, 'collection'))
    out.push(...metafields('collection', input.collectionMetafields))
  }
  out.push(...fixed('shop', SHOP_SOURCE_FIELDS, 'shop'))
  for (const def of input.metaobjects) {
    const fields = def.fields.filter((f) => usable(f.type, f.list))
    for (const entry of def.entries) {
      for (const f of fields) {
        out.push({
          path: `metaobjects.${def.type}.${entry.handle}.${f.key}`,
          type: f.type,
          group: 'metaobject',
          label: f.name,
          entry: entry.displayName,
          definition: def.name,
        })
      }
    }
  }
  return out
}

/** Only what a setting of this kind can show: image settings see image sources, and so on. */
export const optionsFor = (catalog: readonly SourceOption[], kind: SettingKind) =>
  catalog.filter((o) => COMPATIBLE[kind].includes(o.type))

/** Path → type, for validating a template against the store's sources on Save. */
export const catalogTypes = (catalog: readonly SourceOption[]): Map<string, SourceType> =>
  new Map(catalog.map((o) => [o.path, o.type]))
