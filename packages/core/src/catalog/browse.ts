import { type StoreTx, store } from '@commerce/db'
import { eq, type SQL, sql } from 'drizzle-orm'
import { boostClauses } from '../discovery/boost-sql'
import { type CompiledBoosts, NO_BOOSTS } from '../discovery/boosts'
import { searchBoostsFor } from '../discovery/service'
import { soldInRequestCatalog } from '../markets/catalog-rules'
import {
  fieldValues,
  filterField,
  filterWhere,
  metafieldFacets,
  orderBy,
  SELLABLE,
} from './browse-filters'
import {
  type BrowseFilters,
  type BrowseSort,
  EMPTY_FILTERS,
  type UnavailableProducts,
} from './browse-params'
import { configMetafieldKeys, readFilterConfig, type StorefrontFilterConfig } from './filter-config'
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
  /**
   * The store's filter settings (which groups, in what order), null when it has none and the
   * default filters apply. Read with the listing when the input names the store.
   */
  filterConfig: StorefrontFilterConfig | null
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

/**
 * Every active product in scope with the fields filters and sorts need. `ranked` is the search
 * engine's answer for the query; null means search in SQL. A search runs with the store's
 * boosts (Search & discovery): pinned products join the matches and lead the relevance order
 * (`pin`), boosted and buried ones move in `relevance`, all from the row's own columns.
 */
function baseQuery(
  input: BrowseInput,
  ranked: string[] | null = null,
  plan: SearchPlan | null = null,
  boosts: CompiledBoosts = NO_BOOSTS,
): SQL {
  const search = ranked ? rankedClauses(ranked) : searchClauses(plan)
  const boost = search ? boostClauses(boosts) : null
  const join = input.collectionId
    ? sql`join collection_product cp on cp.product_id = p.id and cp.collection_id = ${input.collectionId}`
    : sql``
  const match = search
    ? boost?.pinned
      ? sql`and (${search.match} or ${boost.pinned})`
      : sql`and ${search.match}`
    : sql``
  const relevance = search
    ? boost?.adjust
      ? sql`(${search.relevance}) + ${boost.adjust}`
      : search.relevance
    : sql`0`
  return sql`
    select p.id, p.handle, p.title, p.created_at, p.product_type, p.vendor, p.tags, p.is_gift_card,
      ${input.collectionId ? sql`cp.position` : sql`0`} as position,
      ${relevance} as relevance,
      ${boost?.pin ?? sql`null::int`} as pin,
      (select min(v.price_paise) from variant v where v.product_id = p.id and v.archived_at is null and v.hidden_on_store = false) as min_price,
      exists (
        select 1 from variant v
        left join inventory_level il on il.variant_id = v.id and il.fulfils_online
        where v.product_id = p.id and v.archived_at is null and v.hidden_on_store = false
          and (not v.track_inventory or coalesce(il.on_hand, 0) - coalesce(il.reserved, 0) > 0)
      ) as in_stock,
      p.preorder_enabled
    from product p ${join}
    where p.status = 'active' and not p.is_system_test and ${soldInRequestCatalog(sql`p.id`)} ${match}`
}

type Row = Record<string, unknown>
const num = (v: unknown): number => Number(v ?? 0)

/** The search engine's matches for a search with a store, or null to search in SQL. */
async function rankedFor(tx: StoreTx, storeId: string | undefined, query: string | undefined) {
  if (!storeId || !query || !searchTerms(query).length) return null
  return engineProductIds(tx, storeId, query.trim().slice(0, 100))
}

/** The store's search boosts and the pins for these words; none without a store or a search. */
async function boostsFor(
  tx: StoreTx,
  storeId: string | undefined,
  query: string | undefined,
): Promise<CompiledBoosts> {
  if (!storeId || !query?.trim()) return NO_BOOSTS
  return searchBoostsFor(tx, query)
}

/**
 * A listing (a collection, or a search): its page of handles, total and facets. The search
 * engine's answer wins when the store has one; otherwise the shopper's words run in SQL
 * (`bestPlan`: as typed, typo-corrected when that finds nothing, some-words-match when a
 * multi-word search finds very little).
 */
export async function browseProducts(tx: StoreTx, input: BrowseInput): Promise<BrowseResult> {
  const filterConfig = input.storeId ? await getFilterConfig(tx, input.storeId) : null
  const fieldKeys = configMetafieldKeys(filterConfig)
  const ranked = await rankedFor(tx, input.storeId, input.query)
  const boosts = await boostsFor(tx, input.storeId, input.query)
  if (ranked) {
    return {
      ...(await runBrowse(tx, input, fieldKeys, ranked, null, boosts)),
      corrected: null,
      filterConfig,
    }
  }
  const words = await searchWordsFor(tx, input.storeId, input.query)
  if (!words) {
    return { ...(await runBrowse(tx, input, fieldKeys, null, null)), corrected: null, filterConfig }
  }
  const { result, corrected } = await bestPlan(words, async (plan) => {
    const listing = await runBrowse(tx, input, fieldKeys, null, plan, boosts)
    return { listing, found: listing.total }
  })
  return { ...result.listing, corrected, filterConfig }
}

/** The store's filter settings (`store.preferences.storefrontFilters`), null for the default. */
export async function getFilterConfig(
  tx: StoreTx,
  storeId: string,
): Promise<StorefrontFilterConfig | null> {
  const [row] = await tx
    .select({ config: sql<unknown>`${store.preferences} -> 'storefrontFilters'` })
    .from(store)
    .where(eq(store.id, storeId))
  return readFilterConfig(row?.config)
}

async function runBrowse(
  tx: StoreTx,
  input: BrowseInput,
  fieldKeys: string[] | null,
  ranked: string[] | null,
  plan: SearchPlan | null,
  boosts: CompiledBoosts = NO_BOOSTS,
): Promise<Omit<BrowseResult, 'corrected' | 'filterConfig'>> {
  const base = baseQuery(input, ranked, plan, boosts)
  const unavailable = input.unavailable ?? 'show'
  const filters = filterWhere(input.filters, fieldKeys)
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
    join variant v on v.product_id = b.id and v.archived_at is null and v.hidden_on_store = false
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
    join metafield_definition d on d.id = m.definition_id and ${filterField(fieldKeys)}
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
        fieldKeys !== null,
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
  const boosts = await boostsFor(tx, storeId, q)
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
      with b as (${baseQuery(input, ranked, plan, boosts)})
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
