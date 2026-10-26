/** SOURCE OF TRUTH: the built-in search's SQL — WHAT: how a search plan matches products (title, vendor, type, handle, tags, SKUs, option values, description; run-together words split) and ranks them, and the order the plans are tried in (as typed, typo-corrected, some-words) / WHY: `browseProducts` and `suggestProducts` must find and rank the same way, at least as well as Shopify's search did for an imported store */
import { type SQL, sql } from 'drizzle-orm'
import type { SearchPlan } from './search-text'
import type { SearchWords } from './search-words'

/**
 * A multi-word search whose words together find fewer products than this also lists the
 * products matching some of the words, after the full matches ("dysphoria aria").
 */
const RELAX_BELOW = 5

const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`)

/** The description's plain text: Lexical text nodes, or a legacy plain string. */
const descriptionText = sql`case jsonb_typeof(p.description)
  when 'string' then p.description #>> '{}'
  when 'object' then jsonb_path_query_array(p.description, 'lax $.**.text')::text
end`

/**
 * One term against the product's own fields (everything but the description): Shopify Search &
 * Discovery's scope of title, vendor, type, handle, tags, SKUs and option values ("Black", "XL").
 */
const fieldMatch = (pattern: string): SQL => sql`(
  p.title ilike ${pattern} or p.vendor ilike ${pattern} or p.product_type ilike ${pattern}
  or p.handle ilike ${pattern}
  or exists (select 1 from unnest(p.tags) t where t ilike ${pattern})
  or exists (select 1 from variant sv where sv.product_id = p.id and sv.archived_at is null and sv.sku ilike ${pattern})
  or exists (
    select 1 from product_option spo join product_option_value spov on spov.option_id = spo.id
    where spo.product_id = p.id and spov.value ilike ${pattern}
  )
)`

const every = (parts: SQL[]): SQL => sql`(${sql.join(parts, sql` and `)})`

type Matcher = (pattern: string) => SQL

const contains = (word: string) => `%${escapeLike(word)}%`

const titleMatch: Matcher = (pt) => sql`p.title ilike ${pt}`

const anywhere: Matcher = (pt) => sql`(${fieldMatch(pt)} or ${descriptionText} ilike ${pt})`

/**
 * Term `i` of the plan: the word or one of its synonyms within `match`'s scope, or both words
 * of a split ("glass pad" for "glasspad") within `splitMatch`'s.
 */
function termMatch(plan: SearchPlan, i: number, match: Matcher, splitMatch: Matcher): SQL {
  const words = (plan.groups[i] ?? []).map((w) => match(contains(w)))
  const splits = (plan.splits[i] ?? []).map((phrase) =>
    every(phrase.split(' ').map((w) => splitMatch(contains(w)))),
  )
  return sql`(${sql.join([...words, ...splits], sql` or `)})`
}

/** Every term of the plan matches. */
const allTerms = (plan: SearchPlan, match: Matcher, splitMatch: Matcher = match): SQL =>
  every(plan.terms.map((_, i) => termMatch(plan, i, match, splitMatch)))

/** Postgres regex for `text` taken literally. */
const regexLiteral = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Shopify-style matching: each word (or one of its synonyms) must appear in the title, vendor,
 * type, handle, a tag, a SKU, an option value or the description; a run-together word also
 * matches its two words in the product's own fields ("glasspad" finds "Glass Mousepad").
 * Ranked: title starts with the query, a title word starts with it, title contains it, title
 * holds every word, every word in the product's fields, then description-only matches. In
 * `any` mode products matching only some words follow, the more words the sooner.
 */
export function searchClauses(plan: SearchPlan | null): { match: SQL; relevance: SQL } | null {
  if (!plan?.terms.length) return null
  const query = plan.terms.join(' ')
  const phrase = escapeLike(query)
  const all = allTerms(plan, anywhere, fieldMatch)
  const tier = sql`case
    when p.title ilike ${`${phrase}%`} then 0
    when p.title ~* ${`\\m${regexLiteral(query)}`} then 1
    when p.title ilike ${`%${phrase}%`} then 2
    when ${allTerms(plan, titleMatch)} then 3
    when ${allTerms(plan, fieldMatch)} then 4
    else 5 end`
  if (plan.mode === 'all') return { match: all, relevance: tier }
  const each = plan.terms.map((_, i) => termMatch(plan, i, fieldMatch, fieldMatch))
  const missing = sql.join(
    each.map((m) => sql`(case when ${m} then 0 else 1 end)`),
    sql` + `,
  )
  return {
    match: sql`(${all} or ${sql.join(each, sql` or `)})`,
    relevance: sql`case when ${all} then ${tier} else 5 + ${missing} end`,
  }
}

/**
 * The engine's matches as the search: only those products, ranked in the engine's order. The
 * ids travel as one text parameter (already checked to be uuids by `engineProductIds`).
 */
export function rankedClauses(ids: string[]): { match: SQL; relevance: SQL } {
  const list = sql`string_to_array(${ids.join(',')}, ',')::uuid[]`
  return { match: sql`p.id = any(${list})`, relevance: sql`array_position(${list}, p.id)` }
}

/**
 * A search's SQL runs, best first: the words as typed; only when they find nothing, the
 * typo-corrected words ("Showing results for …"); and when a multi-word search still finds
 * fewer than `RELAX_BELOW`, the products matching some of its words follow the full matches.
 * `run` answers with how many products a plan found.
 */
export async function bestPlan<T extends { found: number }>(
  words: SearchWords,
  run: (plan: SearchPlan) => Promise<T>,
): Promise<{ result: T; corrected: string | null }> {
  let plan = words.typed
  let result = await run(plan)
  let corrected: string | null = null
  if (result.found === 0) {
    const fixed = await words.corrected()
    const again = fixed ? await run(fixed) : null
    if (fixed && again && again.found > 0) {
      plan = fixed
      result = again
      corrected = fixed.corrected
    }
  }
  if (result.found < RELAX_BELOW && plan.terms.length > 1) {
    const relaxed = await run({ ...plan, mode: 'any' })
    if (relaxed.found > result.found) return { result: relaxed, corrected }
  }
  return { result, corrected }
}
