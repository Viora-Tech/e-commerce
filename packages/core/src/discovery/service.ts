/** SOURCE OF TRUTH: Search & discovery in the database — WHAT: recording the storefront's search and recommendation events (hashed session, no personal data, repeats within the link window dropped, adds and orders written only when the session clicked a search result or recommendation in the last 30 minutes) and the search boosts and pins (read for a search, saved by the admin); picked recommendations live in `recommendations.ts`, the Overview in `overview.ts` / WHY: the beacon, the storefront search, the product pages and the admin app share one store of these rows, under RLS. */
import { createHash } from 'node:crypto'
import { discoveryEvent, newId, product, type StoreTx, searchBoost, searchPin } from '@commerce/db'
import { asc, eq, inArray, sql } from 'drizzle-orm'
import { CommerceError } from '../errors'
import {
  BOOST_ACTIONS,
  BOOST_FIELDS,
  type BoostAction,
  type BoostField,
  type CompiledBoosts,
  compileBoosts,
  MAX_BOOST_RULES,
  MAX_BOOST_VALUE,
  MAX_PINNED_TERMS,
  MAX_PINS_PER_TERM,
  type SearchBoostRule,
} from './boosts'
import {
  type DiscoverySource,
  LINK_WINDOW_MINUTES,
  loggableQuery,
  normaliseSearchQuery,
  type RecommendationIntentKind,
} from './query'

const WINDOW = sql.raw(`interval '${LINK_WINDOW_MINUTES} minutes'`)

type Row = Record<string, unknown>
const num = (v: unknown): number => Number(v ?? 0)

/**
 * The session key the log keeps instead of the browser id: a hash of the store and the
 * anonymous `wc_vid` cookie, so the same browser in two stores never links up.
 */
function discoverySessionKey(storeId: string, visitorId: string): string {
  return createHash('sha256').update(`discovery:${storeId}:${visitorId}`).digest('hex').slice(0, 32)
}

export type DiscoveryEventInput =
  | { kind: 'search'; query: string; results: number }
  | { kind: 'impression'; source: RecommendationIntentKind; productId: string }
  | { kind: 'click'; source: DiscoverySource; productId: string; query?: string | undefined }

/**
 * One event from the storefront beacon. A repeated search (same words) or impression (same row
 * on the same product) by the session within the link window is dropped, so a reload or a back
 * button does not count twice. A search that looks like an email or phone number is never kept.
 */
export async function recordDiscoveryEvent(
  tx: StoreTx,
  storeId: string,
  visitorId: string,
  input: DiscoveryEventInput,
): Promise<boolean> {
  const sessionKey = discoverySessionKey(storeId, visitorId)
  const at = sql`now()`
  if (input.kind === 'search') {
    const query = loggableQuery(input.query)
    if (!query) return false
    const results = Math.max(0, Math.min(1_000_000, Math.trunc(input.results) || 0))
    const rows = await tx.execute(sql`
      insert into discovery_event (id, store_id, session_key, source, kind, query, results, created_at)
      select ${newId()}::uuid, ${storeId}::uuid, ${sessionKey}::text, 'search', 'search', ${query}::text, ${results}::int, ${at}
      where not exists (
        select 1 from discovery_event e
        where e.session_key = ${sessionKey} and e.kind = 'search' and e.query = ${query}
          and e.created_at > now() - ${WINDOW}
      )`)
    return num((rows as { count?: number }).count) > 0
  }
  if (input.kind === 'impression') {
    const rows = await tx.execute(sql`
      insert into discovery_event (id, store_id, session_key, source, kind, product_id, created_at)
      select ${newId()}::uuid, ${storeId}::uuid, ${sessionKey}::text, ${input.source}::text, 'impression', ${input.productId}::uuid, ${at}
      where not exists (
        select 1 from discovery_event e
        where e.session_key = ${sessionKey} and e.kind = 'impression' and e.source = ${input.source}
          and e.product_id = ${input.productId}::uuid and e.created_at > now() - ${WINDOW}
      )`)
    return num((rows as { count?: number }).count) > 0
  }
  const query = input.source === 'search' && input.query ? loggableQuery(input.query) : null
  await tx.insert(discoveryEvent).values({
    storeId,
    sessionKey,
    source: input.source,
    kind: 'click',
    query,
    productId: input.productId,
  })
  return true
}

/**
 * An add to cart (the variant added), written only when the session clicked a search result or a recommendation in
 * the last 30 minutes, under that click's source (a click on the same product wins). One
 * statement: a shopper who never searched costs an index probe and no row.
 */
export async function recordDiscoveryAdd(
  tx: StoreTx,
  storeId: string,
  visitorId: string,
  variantId: string,
): Promise<void> {
  const sessionKey = discoverySessionKey(storeId, visitorId)
  await tx.execute(sql`
    insert into discovery_event (id, store_id, session_key, source, kind, product_id)
    select ${newId()}::uuid, ${storeId}::uuid, ${sessionKey}::text, e.source, 'add', v.product_id
    from discovery_event e
    join variant v on v.id = ${variantId}::uuid
    where e.session_key = ${sessionKey} and e.kind = 'click' and e.created_at > now() - ${WINDOW}
    order by (e.product_id = v.product_id) desc, e.created_at desc
    limit 1`)
}

/** An order placed, written only when the session added from search or a recommendation in the last 30 minutes. */
export async function recordDiscoveryCheckout(
  tx: StoreTx,
  storeId: string,
  visitorId: string,
): Promise<void> {
  const sessionKey = discoverySessionKey(storeId, visitorId)
  await tx.execute(sql`
    insert into discovery_event (id, store_id, session_key, source, kind)
    select ${newId()}::uuid, ${storeId}::uuid, ${sessionKey}::text, e.source, 'checkout'
    from discovery_event e
    where e.session_key = ${sessionKey} and e.kind = 'add' and e.created_at > now() - ${WINDOW}
      and not exists (
        select 1 from discovery_event k
        where k.session_key = ${sessionKey} and k.kind = 'checkout' and k.created_at > now() - ${WINDOW}
      )
    order by e.created_at desc
    limit 1`)
}

/** A product's id from its handle, for the beacon's clicks; null when unknown. */
export async function productIdForHandle(tx: StoreTx, handle: string): Promise<string | null> {
  const [row] = await tx
    .select({ id: product.id })
    .from(product)
    .where(eq(product.handle, handle.slice(0, 255)))
    .limit(1)
  return row?.id ?? null
}

// --- Boosts and pins -------------------------------------------------------------------------

/**
 * The boosts one search runs with: every boost and bury rule, and the products pinned for the
 * search's normalised words. One round trip; under RLS, so only this store's rows.
 */
export async function searchBoostsFor(tx: StoreTx, query: string): Promise<CompiledBoosts> {
  const term = normaliseSearchQuery(query)
  const rows = await tx.execute<Row>(sql`
    select 'rule' as row_kind, field, value, action, null::uuid as product_id, 0 as position
      from search_boost
    union all
    select 'pin', null, null, null, sp.product_id, sp.position
      from search_pin sp
      where sp.term = ${term}
    order by row_kind, position`)
  const rules: SearchBoostRule[] = []
  const pins: string[] = []
  for (const r of rows) {
    if (r.row_kind === 'pin') pins.push(String(r.product_id))
    else
      rules.push({
        field: String(r.field) as BoostField,
        value: String(r.value),
        action: String(r.action) as BoostAction,
      })
  }
  return compileBoosts(rules, pins)
}

/** The store's boost and bury rules, as saved. */
export async function listSearchBoostRules(tx: StoreTx): Promise<SearchBoostRule[]> {
  const rows = await tx
    .select({ field: searchBoost.field, value: searchBoost.value, action: searchBoost.action })
    .from(searchBoost)
    .orderBy(asc(searchBoost.createdAt), asc(searchBoost.id))
  return rows.map((r) => ({
    field: r.field as BoostField,
    value: r.value,
    action: r.action as BoostAction,
  }))
}

/** Rules as the admin may save them: known fields and actions, trimmed values, one per value. */
function cleanBoostRules(rules: SearchBoostRule[]): SearchBoostRule[] {
  const seen = new Set<string>()
  const out: SearchBoostRule[] = []
  for (const r of rules) {
    if (!BOOST_FIELDS.includes(r.field) || !BOOST_ACTIONS.includes(r.action)) continue
    const value = r.value.trim().slice(0, MAX_BOOST_VALUE)
    const key = `${r.field}:${value}`
    if (!value || seen.has(key)) continue
    seen.add(key)
    out.push({ field: r.field, value, action: r.action })
  }
  return out.slice(0, MAX_BOOST_RULES)
}

/** Replaces the store's boost and bury rules. */
export async function setSearchBoostRules(
  tx: StoreTx,
  storeId: string,
  rules: SearchBoostRule[],
): Promise<SearchBoostRule[]> {
  const clean = cleanBoostRules(rules)
  await tx.delete(searchBoost)
  if (clean.length) await tx.insert(searchBoost).values(clean.map((r) => ({ storeId, ...r })))
  return listSearchBoostRules(tx)
}

export type PinnedProduct = { id: string; title: string; handle: string; status: string }
export type SearchPinGroup = { term: string; products: PinnedProduct[] }

/** Every search with pins, A to Z, each with its products in pin order. */
export async function listSearchPins(tx: StoreTx): Promise<SearchPinGroup[]> {
  const rows = await tx
    .select({
      term: searchPin.term,
      id: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status,
    })
    .from(searchPin)
    .innerJoin(product, eq(product.id, searchPin.productId))
    .orderBy(asc(searchPin.term), asc(searchPin.position))
  const groups: SearchPinGroup[] = []
  for (const r of rows) {
    let g = groups.find((x) => x.term === r.term)
    if (!g) {
      g = { term: r.term, products: [] }
      groups.push(g)
    }
    g.products.push({ id: r.id, title: r.title, handle: r.handle, status: r.status })
  }
  return groups
}

export class SearchPinLimitError extends CommerceError {
  constructor() {
    super('SEARCH_PIN_LIMIT', `Up to ${MAX_PINNED_TERMS} searches can have pinned products`)
  }
}

/**
 * Pins `productIds` (in order) to the top of the results for `term`, replacing its pins; an
 * empty list removes them. The term is stored normalised, so "Keyboard " and "keyboard" share
 * pins. Unknown product ids are dropped.
 */
export async function setSearchPins(
  tx: StoreTx,
  storeId: string,
  rawTerm: string,
  productIds: string[],
): Promise<SearchPinGroup[]> {
  const term = normaliseSearchQuery(rawTerm)
  if (!term) return listSearchPins(tx)
  const wanted = [...new Set(productIds)].slice(0, MAX_PINS_PER_TERM)
  const known = wanted.length
    ? new Set(
        (await tx.select({ id: product.id }).from(product).where(inArray(product.id, wanted))).map(
          (r) => r.id,
        ),
      )
    : new Set<string>()
  const ids = wanted.filter((id) => known.has(id))
  if (ids.length) {
    const [count] = await tx.execute<Row>(
      sql`select count(distinct term) as n, bool_or(term = ${term}) as has from search_pin`,
    )
    if (!count?.has && num(count?.n) >= MAX_PINNED_TERMS) throw new SearchPinLimitError()
  }
  await tx.delete(searchPin).where(eq(searchPin.term, term))
  if (ids.length) {
    await tx
      .insert(searchPin)
      .values(ids.map((productId, position) => ({ storeId, term, productId, position })))
  }
  return listSearchPins(tx)
}
