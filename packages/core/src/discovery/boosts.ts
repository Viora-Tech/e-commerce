/** SOURCE OF TRUTH: search boosts — WHAT: the merchant's search boosts as data (products pinned to the top for one search, products with a tag, type or vendor moved up or buried), their limits, how saved rules compile into the lists the search SQL reads, and the rank a boosted or buried product ends up with / WHY: the admin's Boosts page, the storefront search (`boost-sql.ts`) and the tests must agree on one ranking. Pure and browser-safe. */

export const BOOST_FIELDS = ['tag', 'type', 'vendor'] as const
export type BoostField = (typeof BOOST_FIELDS)[number]

export const BOOST_ACTIONS = ['boost', 'bury'] as const
export type BoostAction = (typeof BOOST_ACTIONS)[number]

/** One saved rule: products whose `field` is `value` move up (`boost`) or down (`bury`). */
export type SearchBoostRule = { field: BoostField; value: string; action: BoostAction }

/** Products pinned for one search, at most. */
export const MAX_PINS_PER_TERM = 10
/** Searches with pins, at most. */
export const MAX_PINNED_TERMS = 200
/** Boost and bury rules, at most. */
export const MAX_BOOST_RULES = 50
/** Longest tag, type or vendor a rule holds. */
export const MAX_BOOST_VALUE = 255

/**
 * How many relevance tiers a boosted product climbs (`search-sql.ts`: 0 the title starts with the
 * search … 5 only the description matches). Two tiers: a boosted product that matches in its
 * tags passes plain products that match in the title, never a pinned one.
 */
export const BOOST_TIERS = 2

/** What a buried product's rank gains: more than any tier, so it sorts after every unburied match. */
export const BURY_PENALTY = 1000

/** The values each action applies to, per field, as the SQL reads them. */
export type BoostLists = Record<BoostField, string[]>

export type CompiledBoosts = {
  /** Product ids pinned for this search, in order; empty when none. */
  pins: string[]
  boost: BoostLists
  bury: BoostLists
}

const emptyLists = (): BoostLists => ({ tag: [], type: [], vendor: [] })

/** No pins and no rules: the search ranks as it always did. */
export const NO_BOOSTS: CompiledBoosts = { pins: [], boost: emptyLists(), bury: emptyLists() }

/**
 * Saved rules into the lists the search reads: values trimmed, blanks and repeats dropped, and a
 * value both boosted and buried treated as buried (the safer reading of a contradiction). Pins
 * keep their order without repeats, at most `MAX_PINS_PER_TERM`.
 */
export function compileBoosts(rules: SearchBoostRule[], pins: string[] = []): CompiledBoosts {
  const boost = emptyLists()
  const bury = emptyLists()
  for (const r of rules) {
    const value = r.value.trim()
    if (!value) continue
    const list = r.action === 'bury' ? bury[r.field] : boost[r.field]
    if (!list.includes(value)) list.push(value)
  }
  for (const field of BOOST_FIELDS) {
    boost[field] = boost[field].filter((v) => !bury[field].includes(v))
  }
  return { pins: [...new Set(pins)].slice(0, MAX_PINS_PER_TERM), boost, bury }
}

/** True when the boosts change nothing. */
export function boostsEmpty(b: CompiledBoosts): boolean {
  return (
    b.pins.length === 0 &&
    BOOST_FIELDS.every((f) => b.boost[f].length === 0 && b.bury[f].length === 0)
  )
}

/** The product fields a rule looks at. */
export type BoostTarget = { tags: string[]; productType: string | null; vendor: string | null }

const hits = (lists: BoostLists, p: BoostTarget): boolean =>
  p.tags.some((t) => lists.tag.includes(t)) ||
  (p.productType !== null && lists.type.includes(p.productType)) ||
  (p.vendor !== null && lists.vendor.includes(p.vendor))

/** Whether a product is boosted and whether it is buried (the SQL's two flags, in TypeScript). */
export function boostFlags(b: CompiledBoosts, p: BoostTarget): { boosted: boolean; buried: boolean } {
  return { boosted: hits(b.boost, p), buried: hits(b.bury, p) }
}

/**
 * A matched product's rank, lower first: its relevance tier, `BOOST_TIERS` better when boosted,
 * after everything else when buried. Pins sort before any rank (`comparePinned`).
 */
export function searchRank(relevance: number, boosted: boolean, buried: boolean): number {
  return relevance - (boosted ? BOOST_TIERS : 0) + (buried ? BURY_PENALTY : 0)
}

/**
 * Two results in search order: pinned ones first in pin order, then by `searchRank`. The order
 * the SQL's `ORDER BY b.pin nulls last, b.relevance` gives, for tests and previews.
 */
export function comparePinned(
  a: { pin: number | null; rank: number },
  b: { pin: number | null; rank: number },
): number {
  if (a.pin !== null || b.pin !== null) {
    if (a.pin === null) return 1
    if (b.pin === null) return -1
    if (a.pin !== b.pin) return a.pin - b.pin
  }
  return a.rank - b.rank
}
