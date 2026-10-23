/**
 * Growth → Campaigns, Shopify style: one list where a campaign groups everything that carries
 * its name. Our own email and WhatsApp sends, plus the `utm_campaign` names on tracking links
 * and tagged visits, each with its sessions and sales since 1 January (IST).
 */
import { type MarketingCampaignStatus, utmName } from '@commerce/core/marketing'
import { dayStart } from '@commerce/dates'
import {
  customerSegment,
  marketingCampaign,
  marketingSession,
  order,
  type StoreTx,
  shortLink,
} from '@commerce/db'
import { and, eq, gte, isNotNull, sql } from 'drizzle-orm'
import { istIsoDate } from './analytics-buckets'

export type CampaignPerformanceRow = {
  /** `c:<id>` for our sends, `utm:<name>` for tracking-link campaigns. */
  key: string
  kind: 'email' | 'whatsapp' | 'utm'
  /** Our campaign's id; null for a tracking-link campaign. */
  id: string | null
  name: string
  status: MarketingCampaignStatus | null
  segmentName: string | null
  /** Tracking links tagged with this campaign. */
  links: number
  createdAt: string
  updatedAt: string
  sessions: number
  orders: number
  salesPaise: number
}

/** IST midnight on 1 January of `now`'s year. */
function yearStart(now: Date): Date {
  return dayStart(`${istIsoDate(now).slice(0, 4)}-01-01`)
}

type Tally = { sessions: number; orders: number; salesPaise: number; first: Date; last: Date }

/**
 * Every campaign with its year-to-date sessions and sales, most recently updated first.
 * A visit or order counts for our campaign when it carries the campaign's id or its
 * `utm_campaign` tag (as the campaign report does); other tags become tracking-link campaigns.
 */
export async function campaignPerformance(
  tx: StoreTx,
  now = new Date(),
): Promise<CampaignPerformanceRow[]> {
  const since = yearStart(now)
  const attr = (key: string) => sql<string | null>`${order.attribution} ->> ${key}`
  const [campaigns, sessions, orders, links] = await Promise.all([
    tx
      .select({
        id: marketingCampaign.id,
        name: marketingCampaign.name,
        kind: marketingCampaign.kind,
        status: marketingCampaign.status,
        segmentName: customerSegment.name,
        createdAt: marketingCampaign.createdAt,
        updatedAt: marketingCampaign.updatedAt,
      })
      .from(marketingCampaign)
      .leftJoin(customerSegment, eq(customerSegment.id, marketingCampaign.segmentId)),
    tx
      .select({
        campaignId: marketingSession.campaignId,
        tag: sql<string | null>`lower(${marketingSession.campaign})`,
        n: sql<number>`count(*)::int`,
        first: sql<string>`min(${marketingSession.startedAt})`,
        last: sql<string>`max(${marketingSession.startedAt})`,
      })
      .from(marketingSession)
      .where(
        and(
          gte(marketingSession.startedAt, since),
          sql`(${marketingSession.campaignId} is not null or ${marketingSession.campaign} is not null)`,
        ),
      )
      .groupBy(marketingSession.campaignId, sql`lower(${marketingSession.campaign})`),
    tx
      .select({
        campaignId: attr('campaignId'),
        tag: sql<string | null>`lower(${attr('campaign')})`,
        n: sql<number>`count(*)::int`,
        sales: sql<number>`coalesce(sum(${order.totalPaise}), 0)::bigint`,
        first: sql<string>`min(${order.placedAt})`,
        last: sql<string>`max(${order.placedAt})`,
      })
      .from(order)
      .where(
        and(
          gte(order.placedAt, since),
          sql`${order.status} not in ('draft', 'cancelled')`,
          eq(order.isTest, false),
          sql`(${attr('campaignId')} is not null or ${attr('campaign')} is not null)`,
        ),
      )
      // By position: each interpolated key is its own parameter, so the expressions never match.
      .groupBy(sql`1`, sql`2`),
    tx
      .select({
        tag: sql<string>`lower(${shortLink.utmCampaign})`,
        n: sql<number>`count(*)::int`,
        first: sql<string>`min(${shortLink.createdAt})`,
        last: sql<string>`max(${shortLink.updatedAt})`,
      })
      .from(shortLink)
      .where(isNotNull(shortLink.utmCampaign))
      .groupBy(sql`lower(${shortLink.utmCampaign})`),
  ])

  const ours = new Map(campaigns.map((c) => [c.id, c]))
  const byTag = new Map(campaigns.map((c) => [utmName(c.name), c.id]))
  const tallies = new Map<string, Tally>()
  const linkCount = new Map<string, number>()
  /** Our campaign's key when the id or tag is ours, else the tracking-link campaign's. */
  const keyOf = (campaignId: string | null, tag: string | null): string | null => {
    if (campaignId && ours.has(campaignId)) return `c:${campaignId}`
    const t = tag?.trim()
    if (!t) return null
    const owner = byTag.get(t)
    return owner ? `c:${owner}` : `utm:${t}`
  }
  const tally = (key: string, first: Date, last: Date) => {
    let row = tallies.get(key)
    if (!row) {
      row = { sessions: 0, orders: 0, salesPaise: 0, first, last }
      tallies.set(key, row)
    }
    if (first < row.first) row.first = first
    if (last > row.last) row.last = last
    return row
  }
  for (const s of sessions) {
    const key = keyOf(s.campaignId, s.tag)
    if (key) tally(key, new Date(s.first), new Date(s.last)).sessions += s.n
  }
  for (const o of orders) {
    const key = keyOf(o.campaignId, o.tag)
    if (!key) continue
    const row = tally(key, new Date(o.first), new Date(o.last))
    row.orders += o.n
    row.salesPaise += Number(o.sales)
  }
  for (const l of links) {
    const key = keyOf(null, l.tag)
    if (!key) continue
    linkCount.set(key, (linkCount.get(key) ?? 0) + l.n)
    tally(key, new Date(l.first), new Date(l.last))
  }

  const out: CampaignPerformanceRow[] = campaigns.map((c) => {
    const t = tallies.get(`c:${c.id}`)
    return {
      key: `c:${c.id}`,
      kind: c.kind,
      id: c.id,
      name: c.name,
      status: c.status,
      segmentName: c.segmentName,
      links: linkCount.get(`c:${c.id}`) ?? 0,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      sessions: t?.sessions ?? 0,
      orders: t?.orders ?? 0,
      salesPaise: t?.salesPaise ?? 0,
    }
  })
  for (const [key, t] of tallies) {
    if (!key.startsWith('utm:')) continue
    out.push({
      key,
      kind: 'utm',
      id: null,
      name: key.slice(4),
      status: null,
      segmentName: null,
      links: linkCount.get(key) ?? 0,
      createdAt: t.first.toISOString(),
      updatedAt: t.last.toISOString(),
      sessions: t.sessions,
      orders: t.orders,
      salesPaise: t.salesPaise,
    })
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
