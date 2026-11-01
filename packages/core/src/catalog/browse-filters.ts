/** SOURCE OF TRUTH: browse filters and sort in SQL — WHAT: the metafield filter values and facets, the filter WHERE clause and the ORDER BY for each sort / WHY: browseProducts and its facets build on one set of clauses; split out of browse.ts */
import { type SQL, sql } from 'drizzle-orm'
import { FILTERABLE_FIELD_TYPES } from '../metaobjects/schemas'
import type { FacetValue, MetafieldFacet } from './browse'
import type { BrowseFilters, BrowseSort, UnavailableProducts } from './browse-params'

/** In stock or on pre-order: a shopper can buy it now (reads the listing row `b`). */
export const SELLABLE = sql`(b.in_stock or b.preorder_enabled)`

const inList = (values: string[]): SQL =>
  sql`(${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  )})`

/**
 * A filter field's values as text rows (`v.value`), a list field one row per item and a yes/no
 * field `1` or `0`. Reads `m` (the value) and `d` (its definition).
 */
export const fieldValues = sql`lateral (
  select case when d.type = 'boolean' then (case when x.value = 'true' then '1' else '0' end)
    else trim(x.value) end as value
  from jsonb_array_elements_text(
    case when jsonb_typeof(m.value) = 'array' then m.value else jsonb_build_array(m.value) end
  ) as x(value)
) as v`

/** Values one filter offers at most; Shopify shows up to 100 as well. */
const MAX_FIELD_VALUES = 100

/**
 * Which product extra fields can filter (reads `d`, the definition). With filter settings, the
 * fields they name. Without: the ones marked "Use as filter" once any field in the store is
 * marked; until then every field of a filterable type, and `metafieldFacets` keeps the ones whose
 * values read as a filter.
 */
export function filterField(keys: string[] | null): SQL {
  const common = sql`d.storefront_access and d.owner_type = 'product'
  and d.type in ${inList([...FILTERABLE_FIELD_TYPES])}`
  if (keys) {
    return keys.length > 0
      ? sql`${common} and (d.namespace || '.' || d.key) in ${inList(keys)}`
      : sql`false`
  }
  return sql`${common}
  and (d.filterable or not exists (
    select 1 from metafield_definition fd where fd.owner_type = 'product' and fd.filterable
  ))`
}

/** Without marked fields: a guessed filter has repeating values, not one spec line apiece. */
const GUESS = { maxValues: 25, maxLength: 60, perValue: 1.5 }

export function filterWhere(f: BrowseFilters, fieldKeys: string[] | null): SQL {
  const parts: SQL[] = [sql`true`]
  if (f.available !== null) parts.push(f.available ? sql`b.in_stock` : sql`not b.in_stock`)
  if (f.giftCard !== null) parts.push(f.giftCard ? sql`b.is_gift_card` : sql`not b.is_gift_card`)
  if (f.priceMin !== null) parts.push(sql`b.min_price >= ${f.priceMin}`)
  if (f.priceMax !== null) parts.push(sql`b.min_price <= ${f.priceMax}`)
  if (f.productTypes.length) parts.push(sql`b.product_type in ${inList(f.productTypes)}`)
  if (f.vendors.length) parts.push(sql`b.vendor in ${inList(f.vendors)}`)
  if (f.tags.length) {
    parts.push(sql`exists (select 1 from unnest(b.tags) t where t in ${inList(f.tags)})`)
  }
  for (const [prefix, values] of Object.entries(f.tagGroups)) {
    const tags = values.map((v) => `${prefix}-${v}`.toLowerCase())
    parts.push(sql`exists (select 1 from unnest(b.tags) t where lower(t) in ${inList(tags)})`)
  }
  for (const [name, values] of Object.entries(f.options)) {
    parts.push(sql`exists (
      select 1 from variant v
      join variant_option_value vov on vov.variant_id = v.id
      join product_option_value pov on pov.id = vov.option_value_id
      join product_option po on po.id = pov.option_id
      where v.product_id = b.id and v.archived_at is null and v.hidden_on_store = false
        and lower(po.name) = ${name} and pov.value in ${inList(values)}
    )`)
  }
  for (const [field, values] of Object.entries(f.metafields)) {
    // A field the settings no longer name is ignored, not an empty listing.
    if (fieldKeys && !fieldKeys.includes(field)) continue
    const [namespace = '', key = ''] = field.split('.')
    parts.push(sql`exists (
      select 1 from metafield m
      join metafield_definition d on d.id = m.definition_id
      cross join ${fieldValues}
      where m.owner_type = 'product' and m.owner_id = b.id and ${filterField(fieldKeys)}
        and d.namespace = ${namespace} and d.key = ${key} and v.value in ${inList(values)}
    )`)
  }
  return sql.join(parts, sql` and `)
}

type FieldRow = {
  field: string
  name: string
  type: string
  value: string
  count: number
  /** The field is marked "Use as filter". */
  flagged: boolean
}

/**
 * The filter fields of a listing from their value counts (rows in definition order): values in
 * natural order (`2` before `10`), yes before no, at most `MAX_FIELD_VALUES` each. When no field
 * is marked "Use as filter" (an imported store before anyone ticked one), a field shows when its
 * values read as a filter: 2 to 25 short values that repeat across products.
 */
export function metafieldFacets(rows: FieldRow[], chosen = false): MetafieldFacet[] {
  const marked = chosen || rows.some((r) => r.flagged)
  const guessed = (f: MetafieldFacet) => {
    const n = f.values.length
    const products = f.values.reduce((sum, v) => sum + v.count, 0)
    return (
      n >= 2 &&
      n <= GUESS.maxValues &&
      products / n >= GUESS.perValue &&
      f.values.every((v) => v.value.length <= GUESS.maxLength)
    )
  }
  const out: MetafieldFacet[] = []
  for (const r of rows) {
    if (r.value === '') continue
    let f = out.find((x) => x.key === r.field)
    if (!f) {
      f = {
        key: r.field,
        name: r.name,
        type: r.type === 'boolean' ? 'boolean' : 'list',
        values: [],
      }
      out.push(f)
    }
    f.values.push({ value: r.value, count: r.count })
  }
  const natural = (a: FacetValue, b: FacetValue) =>
    a.value.localeCompare(b.value, undefined, { numeric: true, sensitivity: 'base' })
  return out
    .filter((f) => marked || guessed(f))
    .map((f) => ({
      ...f,
      values: (f.type === 'boolean'
        ? f.values.sort((a, b) => b.value.localeCompare(a.value))
        : f.values.sort(natural)
      ).slice(0, MAX_FIELD_VALUES),
    }))
}

export function orderBy(sort: BrowseSort, unavailable: UnavailableProducts = 'show'): SQL {
  if (unavailable === 'last') return sql`${SELLABLE} desc, ${orderBy(sort)}`
  switch (sort) {
    case 'relevance':
      // Pinned products first in the merchant's order; equally relevant: the ones a shopper can
      // buy now first, then the newest (a drop store's latest pads before last year's).
      return sql`b.pin nulls last, b.relevance, ${SELLABLE} desc, b.created_at desc, b.title, b.id`
    case 'best-selling':
      return sql`(
        select coalesce(sum(ol.quantity), 0) from order_line ol
        join variant v on v.id = ol.variant_id
        join "order" o on o.id = ol.order_id
        where v.product_id = b.id and o.status not in ('draft', 'cancelled') and not o.is_test

      ) desc, b.title, b.id`
    case 'title-ascending':
      return sql`b.title, b.id`
    case 'title-descending':
      return sql`b.title desc, b.id`
    case 'price-ascending':
      return sql`b.min_price nulls last, b.title, b.id`
    case 'price-descending':
      return sql`b.min_price desc nulls last, b.title, b.id`
    case 'created-descending':
      return sql`b.created_at desc, b.id`
    default:
      return sql`b.position, b.title, b.id`
  }
}
