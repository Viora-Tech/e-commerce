/** SOURCE OF TRUTH: the storefront filter settings in the database — WHAT: saving `store.preferences.storefrontFilters` (only that key) and listing what a store can filter by (options, product extra fields, tag prefixes, type, brand) for the admin's Filters page / WHY: the merchant picks from what the catalogue actually has; the storefront reads the setting in `browseProducts` */
import { type StoreTx, store } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import { FILTERABLE_FIELD_TYPES } from '../metaobjects/schemas'
import { browseProducts } from './browse'
import { EMPTY_FILTERS } from './browse-params'
import {
  dedupeGroups,
  type StorefrontFilterConfig,
  StorefrontFilterConfigSchema,
  tagPrefixes,
  tagPrefixLabel,
  tagValueLabel,
} from './filter-config'

/** Saves the store's filter settings; null goes back to the default filters. */
export async function setFilterConfig(
  tx: StoreTx,
  storeId: string,
  config: StorefrontFilterConfig | null,
): Promise<StorefrontFilterConfig | null> {
  const clean = config ? dedupeGroups(StorefrontFilterConfigSchema.parse(config)) : null
  await tx
    .update(store)
    .set({
      preferences: clean
        ? sql`jsonb_set(coalesce(${store.preferences}, '{}'::jsonb), '{storefrontFilters}', ${JSON.stringify(clean)}::jsonb, true)`
        : sql`coalesce(${store.preferences}, '{}'::jsonb) - 'storefrontFilters'`,
    })
    .where(eq(store.id, storeId))
  return clean
}

export type FilterSources = {
  /** Variant options (Size, Colour) with how many values they have. */
  options: { key: string; name: string; values: number }[]
  /** Product extra fields of a type that can filter, with how many products have a value. */
  metafields: { key: string; name: string; type: string; products: number; marked: boolean }[]
  /** Tags shaped `prefix-value`, grouped: `hand` → Large, Medium, Small. */
  tagGroups: {
    prefix: string
    name: string
    values: { value: string; label: string; count: number }[]
  }[]
  productTypes: number
  vendors: number
  giftCards: boolean
}

/** What the store's active catalogue can be filtered by, for the settings page. */
export async function filterSources(tx: StoreTx): Promise<FilterSources> {
  const { facets } = await browseProducts(tx, {
    filters: EMPTY_FILTERS,
    sort: 'title-ascending',
    page: 1,
    perPage: 1,
  })
  const types = sql.join(
    FILTERABLE_FIELD_TYPES.map((t) => sql`${t}`),
    sql`, `,
  )
  const fields = await tx.execute<Record<string, unknown>>(sql`
    select d.namespace || '.' || d.key as key, d.name, d.type, d.filterable,
      (select count(distinct m.owner_id) from metafield m
        join product p on p.id = m.owner_id and p.status = 'active'
        where m.definition_id = d.id and m.owner_type = 'product') as products
    from metafield_definition d
    where d.owner_type = 'product' and d.storefront_access and d.type in (${types})
    order by d.position, d.namespace, d.key`)
  return {
    options: facets.options.map((o) => ({ key: o.key, name: o.name, values: o.values.length })),
    metafields: fields.map((r) => ({
      key: String(r.key),
      name: String(r.name),
      type: String(r.type),
      products: Number(r.products ?? 0),
      marked: r.filterable === true,
    })),
    tagGroups: tagPrefixes(facets.tags).map((g) => ({
      prefix: g.prefix,
      name: tagPrefixLabel(g.prefix),
      values: g.values.map((v) => ({ ...v, label: tagValueLabel(v.value) })),
    })),
    productTypes: facets.productTypes.length,
    vendors: facets.vendors.length,
    giftCards: facets.giftCards > 0,
  }
}
