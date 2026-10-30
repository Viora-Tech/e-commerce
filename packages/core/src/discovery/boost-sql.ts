/** SOURCE OF TRUTH: search boosts in SQL — WHAT: the clauses `browse.ts` adds to a search's base query: the pin position (`array_position` over the pinned ids), the pinned products joining the matches, and the rank change for boosted and buried products, read from the product row's own columns (tags, type, vendor) / WHY: a boost must not add a per-row subquery to the search (every product row would run it); array overlap and `= any` on the row keep it one scan. Ranking rules: `boosts.ts`. */
import { type SQL, sql } from 'drizzle-orm'
import {
  BOOST_TIERS,
  type BoostLists,
  BURY_PENALTY,
  boostsEmpty,
  type CompiledBoosts,
} from './boosts'

/** Each value its own parameter: boost lists are short, and no value can break the array. */
const textArray = (values: string[]): SQL =>
  sql`array[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  )}]::text[]`

const uuidArray = (ids: string[]): SQL =>
  sql`array[${sql.join(
    ids.map((v) => sql`${v}`),
    sql`, `,
  )}]::uuid[]`

/** The product row `p` carries one of the values: a tag in common, or the type or vendor. */
function anyHit(lists: BoostLists): SQL | null {
  const parts: SQL[] = []
  if (lists.tag.length) parts.push(sql`p.tags && ${textArray(lists.tag)}`)
  if (lists.type.length) parts.push(sql`p.product_type = any(${textArray(lists.type)})`)
  if (lists.vendor.length) parts.push(sql`p.vendor = any(${textArray(lists.vendor)})`)
  return parts.length ? sql`(${sql.join(parts, sql` or `)})` : null
}

export type BoostClauses = {
  /** The product's place among the pins (1 first), null when not pinned. */
  pin: SQL
  /** Pinned products, which join the matches even when the words miss them. */
  pinned: SQL | null
  /** Added to the relevance tier: `-BOOST_TIERS` when boosted, `+BURY_PENALTY` when buried. */
  adjust: SQL | null
}

/** The clauses for one search's boosts (`searchRank` and `comparePinned` in SQL). */
export function boostClauses(b: CompiledBoosts): BoostClauses {
  if (boostsEmpty(b)) return { pin: sql`null::int`, pinned: null, adjust: null }
  const pins = b.pins.length ? uuidArray(b.pins) : null
  const up = anyHit(b.boost)
  const down = anyHit(b.bury)
  const parts: SQL[] = []
  if (up) parts.push(sql`(case when ${up} then ${sql.raw(String(-BOOST_TIERS))} else 0 end)`)
  if (down) parts.push(sql`(case when ${down} then ${sql.raw(String(BURY_PENALTY))} else 0 end)`)
  return {
    pin: pins ? sql`array_position(${pins}, p.id)` : sql`null::int`,
    pinned: pins ? sql`p.id = any(${pins})` : null,
    adjust: parts.length ? sql`(${sql.join(parts, sql` + `)})` : null,
  }
}
