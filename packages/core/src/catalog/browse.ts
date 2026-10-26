import type { StoreTx } from '@commerce/db'
import { type SQL, sql } from 'drizzle-orm'
import { FILTERABLE_FIELD_TYPES } from '../metaobjects/schemas'
import {
  type BrowseFilters,
  type BrowseSort,
  EMPTY_FILTERS,
  type UnavailableProducts,
} from './browse-params'
import { engineProductIds } from './search-engine'
import { bestPlan, rankedClauses, searchClauses } from './search-sql'
import { type SearchPlan, searchTerms } from './search-text'
import { searchWordsFor } from './search-words'

/**
 * Collection and search listings with Shopify-style filters, facets and sorts,
 * in SQL so a large catalogue pages in the database rather than in memory.
 * Runs under the caller's RLS scope; nothing here names a store.
 */

export type FacetValue = { value: string; count: number }

export type BrowseFacets = {
  inStock: number
  outOfStock: number
  /** How many are gift cards; the kind filter shows only when a listing mixes them with products. */
  giftCards: number
  products: number
  /** Lowest and highest product price in the listing, paise; null when empty. */
  priceMin: number | null
  priceMax: number | null
  productTypes: FacetValue[]
  vendors: FacetValue[]
  tags: FacetValue[]
  /** Options such as Size and Colour, with the values any product offers. */
  options: { key: string; name: string; values: FacetValue[] }[]
  /**
   * Product extra fields marked "Use as filter" (`namespace.key`, the field's name, its values),
   * like Shopify's Search & Discovery filters on metafields (Hand size, Grip, Switches). A yes/no
   * field reads `1` and `0`, as Shopify's boolean filters do.
   */
  metafields: MetafieldFacet[]
}

export type MetafieldFacet = {
  key: string
  name: string
  type: 'list' | 'boolean'
  values: FacetValue[]
}

export type BrowseResult = {
  /** Product handles for this page, in order; cards are loaded by the caller. */
  handles: string[]
  total: number
  facets: BrowseFacets
  /**
   * The search as corrected when the words as typed found nothing ("keybord" → "keyboard"),
   * for "Showing results for …"; null when the shopper's own words were used.
   */
  corrected: string | null
}

export type BrowseInput = {
  /** Limit to one collection's members (and allow its manual order). */
  collectionId?: string | undefined
  /** Free-text search over title, vendor, type, handle, tags, SKU and description. */
  query?: string | undefined
  /**
   * The store, so a search can ask its search engine (the Meilisearch app) for the matching
   * products first. Left out, or no engine ready, the built-in SQL search runs.
   */
  storeId?: string | undefined
  filters: BrowseFilters
  sort: BrowseSort
  page: number
  perPage: number
  /**
   * Sold-out products (not in stock and not on pre-order), as Shopify's
   * `options[unavailable_products]`: `show` where they rank (the default), `last` after every
   * buyable one, `hide` left out.
   */
  unavailable?: UnavailableProducts | undefined
}

/** In stock or on pre-order: a shopper can buy it now (reads the listing row `b`). */
const SELLABLE = sql`(b.in_stock or b.preorder_enabled)`

const inList = (values: string[]): SQL =>
  sql`(${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  )})`

/**
 * Every active product in scope with the fields filters and sorts need. `ranked` is the search
 * engine's answer for the query; null means search in SQL.
 */
function baseQuery(
  input: BrowseInput,
  ranked: string[] | null = null,
  plan: SearchPlan | null = null,
): SQL {
  const search = ranked ? rankedClauses(ranked) : searchClauses(plan)
  const join = input.collectionId
    ? sql`join collection_product cp on cp.product_id = p.id and cp.collection_id = ${input.collectionId}`
    : sql``
  const match = search ? sql`and ${search.match}` : sql``
  const relevance = search?.relevance ?? sql`0`
  return sql`
    select p.id, p.handle, p.title, p.created_at, p.product_type, p.vendor, p.tags, p.is_gift_card,
      ${input.collectionId ? sql`cp.position` : sql`0`} as position,
      ${relevance} as relevance,
      (select min(v.price_paise) from variant v where v.product_id = p.id and v.archived_at is null) as min_price,
      exists (
        select 1 from variant v
        left join inventory_level il on il.variant_id = v.id and il.fulfils_online
        where v.product_id = p.id and v.archived_at is null
          and (not v.track_inventory or coalesce(il.on_hand, 0) - coalesce(il.reserved, 0) > 0)
      ) as in_stock,
      p.preorder_enabled
    from product p ${join}
    where p.status = 'active' and not p.is_system_test ${match}`
}

/**
 * A filter field's values as text rows (`v.value`), a list field one row per item and a yes/no
 * field `1` or `0`. Reads `m` (the value) and `d` (its definition).
 */
const fieldValues = sql`lateral (
  select case when d.type = 'boolean' then (case when x.value = 'true' then '1' else '0' end)
    else trim(x.value) end as value
  from jsonb_array_elements_text(
    case when jsonb_typeof(m.value) = 'array' then m.value else jsonb_build_array(m.value) end
  ) as x(value)
) as v`

/** Values one filter offers at most; Shopify shows up to 100 as well. */
const MAX_FIELD_VALUES = 100

/**
 * Which product extra fields can filter (reads `d`, the definition): the ones marked "Use as
 * filter" once any field in the store is marked; until then every field of a filterable type,
 * and `metafieldFacets` keeps the ones whose values read as a filter.
 */
const filterField = sql`d.storefront_access and d.owner_type = 'product'
  and d.type in ${inList([...FILTERABLE_FIELD_TYPES])}
  and (d.filterable or not exists (
    select 1 from metafield_definition fd where fd.owner_type = 'product' and fd.filterable
  ))`

/** Without marked fields: a guessed filter has repeating values, not one spec line apiece. */
const GUESS = { maxValues: 25, maxLength: 60, perValue: 1.5 }

function filterWhere(f: BrowseFilters): SQL {
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
  for (const [name, values] of Object.entries(f.options)) {
    parts.push(sql`exists (
      select 1 from variant v
      join variant_option_value vov on vov.variant_id = v.id
      join product_option_value pov on pov.id = vov.option_value_id
      join product_option po on po.id = pov.option_id
      where v.product_id = b.id and v.archived_at is null
        and lower(po.name) = ${name} and pov.value in ${inList(values)}
    )`)
  }
  for (const [field, values] of Object.entries(f.metafields)) {
    const [namespace = '', key = ''] = field.split('.')
    parts.push(sql`exists (
      select 1 from metafield m
      join metafield_definition d on d.id = m.definition_id
      cross join ${fieldValues}
      where m.owner_type = 'product' and m.owner_id = b.id and ${filterField}
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
export function metafieldFacets(rows: FieldRow[]): MetafieldFacet[] {
  const marked = rows.some((r) => r.flagged)
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

function orderBy(sort: BrowseSort, unavailable: UnavailableProducts = 'show'): SQL {
  if (unavailable === 'last') return sql`${SELLABLE} desc, ${orderBy(sort)}`
  switch (sort) {
    case 'relevance':
      // Equally relevant: the ones a shopper can buy now first, then the newest (a drop store's
      // latest pads before last year's).
      return sql`b.relevance, ${SELLABLE} desc, b.created_at desc, b.title, b.id`
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

type Row = Record<string, unknown>
const num = (v: unknown): number => Number(v ?? 0)

/** The search engine's matches for a search with a store, or null to search in SQL. */
async function rankedFor(tx: StoreTx, storeId: string | undefined, query: string | undefined) {
  if (!storeId || !query || !searchTerms(query).length) return null
  return engineProductIds(tx, storeId, query.trim().slice(0, 100))
}

/**
 * A listing (a collection, or a search): its page of handles, total and facets. The search
 * engine's answer wins when the store has one; otherwise the shopper's words run in SQL
 * (`bestPlan`: as typed, typo-corrected when that finds nothing, some-words-match when a
 * multi-word search finds very little).
 */
export async function browseProducts(tx: StoreTx, input: BrowseInput): Promise<BrowseResult> {
  const ranked = await rankedFor(tx, input.storeId, input.query)
  if (ranked) return { ...(await runBrowse(tx, input, ranked, null)), corrected: null }
  const words = await searchWordsFor(tx, input.storeId, input.query)
  if (!words) return { ...(await runBrowse(tx, input, null, null)), corrected: null }
  const { result, corrected } = await bestPlan(words, async (plan) => {
    const listing = await runBrowse(tx, input, null, plan)
    return { listing, found: listing.total }
  })
  return { ...result.listing, corrected }
}

async function runBrowse(
  tx: StoreTx,
  input: BrowseInput,
  ranked: string[] | null,
  plan: SearchPlan | null,
): Promise<Omit<BrowseResult, 'corrected'>> {
  const base = baseQuery(input, ranked, plan)
  const unavailable = input.unavailable ?? 'show'
  const filters = filterWhere(input.filters)
  const where = unavailable === 'hide' ? sql`${filters} and ${SELLABLE}` : filters
  const offset = (Math.max(1, input.page) - 1) * input.perPage

  const page = await tx.execute<Row>(sql`
    with b as (${base})
    select b.handle, count(*) over () as total from b where ${where}
    order by ${orderBy(input.sort, unavailable)} limit ${input.perPage} offset ${offset}`)
  let total = num(page[0]?.total)
  if (page.length === 0 && offset > 0) {
    const [c] = await tx.execute<Row>(
      sql`with b as (${base}) select count(*) as n from b where ${where}`,
    )
    total = num(c?.n)
  }

  const [stats] = await tx.execute<Row>(sql`
    with b as (${base})
    select count(*) filter (where in_stock) as in_stock, count(*) filter (where not in_stock) as out_stock,
      count(*) filter (where is_gift_card) as gift_cards, count(*) filter (where not is_gift_card) as products,
      min(min_price) as price_min, max(min_price) as price_max from b`)
  const facetRows = await tx.execute<Row>(sql`
    with b as (${base})
    select 'type' as kind, null as name, product_type as value, count(*) as n from b
      where coalesce(product_type, '') <> '' group by product_type
    union all
    select 'vendor', null, vendor, count(*) from b where coalesce(vendor, '') <> '' group by vendor
    union all
    select 'tag', null, t, count(*) from b, unnest(b.tags) t where t <> '' group by t`)
  const optionRows = await tx.execute<Row>(sql`
    with b as (${base})
    select lower(po.name) as key, min(po.name) as name, pov.value, count(distinct b.id) as n,
      min(po.position) as opos, min(pov.position) as vpos
    from b
    join variant v on v.product_id = b.id and v.archived_at is null
    join variant_option_value vov on vov.variant_id = v.id
    join product_option_value pov on pov.id = vov.option_value_id
    join product_option po on po.id = pov.option_id
    where lower(po.name) <> 'title'
    group by lower(po.name), pov.value
    order by opos, key, vpos, pov.value`)

  const fieldRows = await tx.execute<Row>(sql`
    with b as (${base})
    select d.namespace || '.' || d.key as field, min(d.name) as name, min(d.type) as type,
      v.value, count(distinct b.id) as n, min(d.position) as pos, bool_or(d.filterable) as flagged
    from b
    join metafield m on m.owner_type = 'product' and m.owner_id = b.id
    join metafield_definition d on d.id = m.definition_id and ${filterField}
    cross join ${fieldValues}
    where v.value <> ''
    group by d.namespace, d.key, v.value
    order by pos, field, v.value`)

  const values = (kind: string): FacetValue[] =>
    facetRows
      .filter((r) => r.kind === kind)
      .map((r) => ({ value: String(r.value), count: num(r.n) }))
      .sort((a, b) => a.value.localeCompare(b.value))
  const options: BrowseFacets['options'] = []
  for (const r of optionRows) {
    const key = String(r.key)
    let o = options.find((x) => x.key === key)
    if (!o) {
      o = { key, name: String(r.name), values: [] }
      options.push(o)
    }
    o.values.push({ value: String(r.value), count: num(r.n) })
  }

  return {
    handles: page.map((r) => String(r.handle)),
    total,
    facets: {
      inStock: num(stats?.in_stock),
      outOfStock: num(stats?.out_stock),
      giftCards: num(stats?.gift_cards),
      products: num(stats?.products),
      priceMin: stats?.price_min == null ? null : num(stats.price_min),
      priceMax: stats?.price_max == null ? null : num(stats.price_max),
      productTypes: values('type'),
      vendors: values('vendor'),
      tags: values('tag'),
      options,
      metafields: metafieldFacets(
        fieldRows.map((r) => ({
          field: String(r.field),
          name: String(r.name),
          type: String(r.type),
          value: String(r.value),
          count: num(r.n),
          flagged: r.flagged === true,
        })),
      ),
    },
  }
}

/**
 * Quick matches for the header's predictive search: a few product handles, best first. With
 * `storeId`, the store's search engine ranks them when it has one ready. `unavailable` is
 * Shopify's `resources[options][unavailable_products]`: by default (`show`) a sold-out product
 * ranks by relevance, after equally relevant buyable ones.
 */
export async function suggestProducts(
  tx: StoreTx,
  query: string,
  limit = 6,
  storeId?: string,
  unavailable: UnavailableProducts = 'show',
): Promise<string[]> {
  const q = query.trim().slice(0, 100)
  if (q.length < 2) return []
  const ranked = storeId ? await engineProductIds(tx, storeId, q, limit * 4) : null
  const input = {
    query: q,
    filters: EMPTY_FILTERS,
    sort: 'relevance' as const,
    page: 1,
    perPage: limit,
  }
  const hide = unavailable === 'hide' ? sql`where ${SELLABLE}` : sql``
  const run = async (plan: SearchPlan | null) => {
    const rows = await tx.execute<Row>(sql`
      with b as (${baseQuery(input, ranked, plan)})
      select b.handle from b ${hide} order by ${orderBy('relevance', unavailable)} limit ${limit}`)
    return rows.map((r) => String(r.handle))
  }
  if (ranked) return run(null)
  const words = await searchWordsFor(tx, storeId, q)
  if (!words) return []
  // As the search page: typo-corrected when nothing matched, some-words when very little did.
  const { result } = await bestPlan(words, async (plan) => {
    const handles = await run(plan)
    return { handles, found: handles.length }
  })
  return result.handles
}
