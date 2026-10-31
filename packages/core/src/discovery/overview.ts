/** SOURCE OF TRUTH: Search & discovery Overview — WHAT: the app's Overview for a period: the search funnel (searched, clicked, added, ordered within the link window) against the period before, the search lists and the recommendation rows' views, clicks and adds / WHY: one read over discovery_event, split out of discovery/service.ts */
import type { StoreTx } from '@commerce/db'
import { sql } from 'drizzle-orm'
import {
  type DiscoveryOverview,
  LINK_WINDOW_MINUTES,
  type RecommendationStat,
  type SearchFunnel,
  type SearchQueryStat,
  splitSearchLists,
} from './query'

const WINDOW = sql.raw(`interval '${LINK_WINDOW_MINUTES} minutes'`)
const DAY_MS = 86_400_000

type Row = Record<string, unknown>
const num = (v: unknown): number => Number(v ?? 0)

/** Searches read for the lists: the most searched, enough for three lists of 20. */
const QUERY_POOL = 500

type Range = { from: Date; to: Date }

async function searchFunnel(tx: StoreTx, { from, to }: Range): Promise<SearchFunnel> {
  const [r] = await tx.execute<Row>(sql`
    with s as (
      select e.session_key, e.created_at from discovery_event e
      where e.kind = 'search' and e.created_at >= ${from.toISOString()}::timestamptz and e.created_at < ${to.toISOString()}::timestamptz
    ), c as (
      select s.session_key, (
        select min(x.created_at) from discovery_event x
        where x.session_key = s.session_key and x.kind = 'click' and x.source = 'search'
          and x.created_at >= s.created_at and x.created_at <= s.created_at + ${WINDOW}
      ) as clicked_at
      from s
    ), a as (
      select c.session_key, c.clicked_at, case when c.clicked_at is null then null else (
        select min(x.created_at) from discovery_event x
        where x.session_key = c.session_key and x.kind = 'add' and x.source = 'search'
          and x.created_at >= c.clicked_at and x.created_at <= c.clicked_at + ${WINDOW}
      ) end as added_at
      from c
    ), k as (
      select a.session_key, a.clicked_at, a.added_at, a.added_at is not null and exists (
        select 1 from discovery_event x
        where x.session_key = a.session_key and x.kind = 'checkout'
          and x.created_at >= a.added_at and x.created_at <= a.added_at + ${WINDOW}
      ) as ordered
      from a
    )
    select count(distinct session_key) as sessions,
      count(distinct session_key) filter (where clicked_at is not null) as clicked,
      count(distinct session_key) filter (where added_at is not null) as added,
      count(distinct session_key) filter (where ordered) as checked_out
    from k`)
  return {
    sessions: num(r?.sessions),
    clicked: num(r?.clicked),
    added: num(r?.added),
    checkedOut: num(r?.checked_out),
  }
}

async function searchQueryStats(tx: StoreTx, { from, to }: Range): Promise<SearchQueryStat[]> {
  const rows = await tx.execute<Row>(sql`
    with s as (
      select e.query, e.session_key, e.created_at, e.results from discovery_event e
      where e.kind = 'search' and e.query is not null
        and e.created_at >= ${from.toISOString()}::timestamptz and e.created_at < ${to.toISOString()}::timestamptz
    ), x as (
      select s.*, exists (
        select 1 from discovery_event c
        where c.session_key = s.session_key and c.kind = 'click' and c.source = 'search'
          and c.created_at >= s.created_at and c.created_at <= s.created_at + ${WINDOW}
      ) as clicked
      from s
    )
    select query, count(*) as searches, count(distinct session_key) as sessions,
      (array_agg(results order by created_at desc))[1] as results,
      count(distinct session_key) filter (where clicked) as clicked_sessions
    from x
    group by query
    order by searches desc, query
    limit ${QUERY_POOL}`)
  return rows.map((r) => ({
    query: String(r.query),
    searches: num(r.searches),
    sessions: num(r.sessions),
    results: num(r.results),
    clickedSessions: num(r.clicked_sessions),
  }))
}

async function recommendationStats(
  tx: StoreTx,
  { from, to }: Range,
): Promise<RecommendationStat[]> {
  const rows = await tx.execute<Row>(sql`
    select source,
      count(*) filter (where kind = 'impression') as impressions,
      count(*) filter (where kind = 'click') as clicks,
      count(*) filter (where kind = 'add') as adds
    from discovery_event
    where source in ('related', 'complementary') and created_at >= ${from.toISOString()}::timestamptz and created_at < ${to.toISOString()}::timestamptz
    group by source`)
  return (['related', 'complementary'] as const).map((intent) => {
    const r = rows.find((x) => x.source === intent)
    return {
      intent,
      impressions: num(r?.impressions),
      clicks: num(r?.clicks),
      adds: num(r?.adds),
    }
  })
}

/** The app's Overview for the last `days` days, with the funnel for the days before. */
export async function discoveryOverview(
  tx: StoreTx,
  days: number,
  now = new Date(),
): Promise<DiscoveryOverview> {
  const current = { from: new Date(now.getTime() - days * DAY_MS), to: now }
  const previous = { from: new Date(now.getTime() - 2 * days * DAY_MS), to: current.from }
  const [funnel, before, stats, recommendations] = [
    await searchFunnel(tx, current),
    await searchFunnel(tx, previous),
    await searchQueryStats(tx, current),
    await recommendationStats(tx, current),
  ]
  return {
    days,
    funnel,
    previous: before,
    ...splitSearchLists(stats),
    recommendations,
  }
}
