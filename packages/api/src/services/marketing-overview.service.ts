import type { MarketingChannel } from '@commerce/core/marketing'
import {
  marketingAutomation,
  marketingCampaign,
  marketingSession,
  order,
  type StoreTx,
} from '@commerce/db'
import { and, gte, inArray, lt, ne, sql } from 'drizzle-orm'
import {
  bucketByDay,
  conversionRate,
  delta,
  type RangeInput,
  resolveRange,
  type SeriesPoint,
  toDailyPoints,
  toWeeklyPoints,
} from './analytics-buckets'

/** Orders placed before attribution existed, or without a beacon (API, drafts), have no channel. */
export type OverviewChannel = MarketingChannel | 'untracked'

export type MarketingKpi = {
  id: 'sessions' | 'attributed_sales' | 'attributed_orders' | 'conversion'
  value: number
  previous: number
  delta: number | null
  series: number[]
}

export type ChannelRow = {
  channel: OverviewChannel
  sessions: number
  orders: number
  salesPaise: number
  conversion: number
}

export type CampaignRow = {
  /** `our:<id>` for campaigns and automations sent from here, `utm:<name>` for tagged links. */
  key: string
  kind: 'email' | 'whatsapp' | 'automation' | 'utm'
  name: string
  /** Detail page for our own campaigns and automations. */
  href: string | null
  source: string | null
  medium: string | null
  sessions: number
  orders: number
  salesPaise: number
}

export type MarketingOverview = {
  range: { key: string; from: string; to: string; days: string[] }
  kpis: MarketingKpi[]
  salesOverTime: { day: SeriesPoint[]; week: SeriesPoint[] }
  channels: ChannelRow[]
  campaigns: CampaignRow[]
}

const TOP_CAMPAIGNS = 10
const counted = and(ne(order.status, 'draft'), ne(order.status, 'cancelled'))

type SessionRow = {
  channel: string
  source: string | null
  medium: string | null
  campaign: string | null
  campaignId: string | null
  automationId: string | null
  startedAt: Date
}

type AttributedOrder = {
  placedAt: Date
  totalPaise: number
  channel: string | null
  source: string | null
  medium: string | null
  campaign: string | null
  campaignId: string | null
  automationId: string | null
}

async function sessionsIn(tx: StoreTx, from: Date, to: Date): Promise<SessionRow[]> {
  return tx
    .select({
      channel: marketingSession.channel,
      source: marketingSession.source,
      medium: marketingSession.medium,
      campaign: marketingSession.campaign,
      campaignId: marketingSession.campaignId,
      automationId: marketingSession.automationId,
      startedAt: marketingSession.startedAt,
    })
    .from(marketingSession)
    .where(and(gte(marketingSession.startedAt, from), lt(marketingSession.startedAt, to)))
}

async function ordersIn(tx: StoreTx, from: Date, to: Date): Promise<AttributedOrder[]> {
  return tx
    .select({
      placedAt: order.placedAt,
      totalPaise: order.totalPaise,
      channel: sql<string | null>`${order.attribution}->>'channel'`,
      source: sql<string | null>`${order.attribution}->>'source'`,
      medium: sql<string | null>`${order.attribution}->>'medium'`,
      campaign: sql<string | null>`${order.attribution}->>'campaign'`,
      campaignId: sql<string | null>`${order.attribution}->>'campaignId'`,
      automationId: sql<string | null>`${order.attribution}->>'automationId'`,
    })
    .from(order)
    .where(and(counted, gte(order.placedAt, from), lt(order.placedAt, to)))
}

/** Direct and untracked orders are not credited to marketing. */
const isAttributed = (o: AttributedOrder) => Boolean(o.channel) && o.channel !== 'direct'

function channelRows(sessions: SessionRow[], orders: AttributedOrder[]): ChannelRow[] {
  const by = new Map<OverviewChannel, ChannelRow>()
  const get = (channel: OverviewChannel) => {
    let row = by.get(channel)
    if (!row) {
      row = { channel, sessions: 0, orders: 0, salesPaise: 0, conversion: 0 }
      by.set(channel, row)
    }
    return row
  }
  for (const s of sessions) get(s.channel as MarketingChannel).sessions += 1
  for (const o of orders) {
    const row = get((o.channel as MarketingChannel | null) ?? 'untracked')
    row.orders += 1
    row.salesPaise += o.totalPaise
  }
  return [...by.values()]
    .map((r) => ({ ...r, conversion: conversionRate(r.orders, r.sessions) }))
    .sort((a, b) => b.salesPaise - a.salesPaise || b.sessions - a.sessions)
}

function campaignKey(r: {
  campaignId: string | null
  automationId: string | null
  campaign: string | null
}): string | null {
  if (r.campaignId) return `our:c:${r.campaignId}`
  if (r.automationId) return `our:a:${r.automationId}`
  if (r.campaign) return `utm:${r.campaign.toLowerCase()}`
  return null
}

async function campaignRows(
  tx: StoreTx,
  sessions: SessionRow[],
  orders: AttributedOrder[],
): Promise<CampaignRow[]> {
  const by = new Map<string, CampaignRow>()
  const touch = (r: SessionRow | AttributedOrder) => {
    const key = campaignKey(r)
    if (!key) return null
    let row = by.get(key)
    if (!row) {
      row = {
        key,
        kind: 'utm',
        name: r.campaign ?? '',
        href: null,
        source: r.source,
        medium: r.medium,
        sessions: 0,
        orders: 0,
        salesPaise: 0,
      }
      by.set(key, row)
    }
    return row
  }
  for (const s of sessions) {
    const row = touch(s)
    if (row) row.sessions += 1
  }
  for (const o of orders) {
    if (!isAttributed(o)) continue
    const row = touch(o)
    if (!row) continue
    row.orders += 1
    row.salesPaise += o.totalPaise
  }
  const campaignIds = [...by.keys()].filter((k) => k.startsWith('our:c:')).map((k) => k.slice(6))
  const automationIds = [...by.keys()].filter((k) => k.startsWith('our:a:')).map((k) => k.slice(6))
  const [campaigns, automations] = await Promise.all([
    campaignIds.length
      ? tx
          .select({
            id: marketingCampaign.id,
            name: marketingCampaign.name,
            kind: marketingCampaign.kind,
          })
          .from(marketingCampaign)
          .where(inArray(marketingCampaign.id, campaignIds))
      : [],
    automationIds.length
      ? tx
          .select({ id: marketingAutomation.id, name: marketingAutomation.name })
          .from(marketingAutomation)
          .where(inArray(marketingAutomation.id, automationIds))
      : [],
  ])
  for (const c of campaigns) {
    const row = by.get(`our:c:${c.id}`)
    if (row)
      Object.assign(row, { kind: c.kind, name: c.name, href: `/marketing/campaigns/${c.id}` })
  }
  for (const a of automations) {
    const row = by.get(`our:a:${a.id}`)
    if (row)
      Object.assign(row, {
        kind: 'automation',
        name: a.name,
        href: `/marketing/automations/${a.id}`,
      })
  }
  return [...by.values()]
    .filter((r) => r.name)
    .sort((a, b) => b.salesPaise - a.salesPaise || b.sessions - a.sessions)
    .slice(0, TOP_CAMPAIGNS)
}

/**
 * The Marketing overview for one range: sessions and attributed sales with
 * the change against the previous period, sales by channel and the campaigns
 * (tagged links, email and WhatsApp sends, automations) that drove them.
 */
export async function marketingOverview(
  tx: StoreTx,
  opts: { range?: RangeInput; now?: Date } = {},
): Promise<MarketingOverview> {
  const range = resolveRange(opts.range ?? { key: '30d' }, opts.now ?? new Date())
  const [sessions, sessionsPrev, orders, ordersPrev] = await Promise.all([
    sessionsIn(tx, range.from, range.to),
    sessionsIn(tx, range.previousFrom, range.previousTo),
    ordersIn(tx, range.from, range.to),
    ordersIn(tx, range.previousFrom, range.previousTo),
  ])
  const attributed = orders.filter(isAttributed)
  const attributedPrev = ordersPrev.filter(isAttributed)
  const sales = attributed.reduce((n, o) => n + o.totalPaise, 0)
  const salesPrev = attributedPrev.reduce((n, o) => n + o.totalPaise, 0)

  const sessionsByDay = bucketByDay(
    sessions.map((s) => ({ at: s.startedAt })),
    range.days,
  )
  const salesByDay = bucketByDay(
    attributed.map((o) => ({ at: o.placedAt, weight: o.totalPaise })),
    range.days,
  )
  const ordersByDay = bucketByDay(
    attributed.map((o) => ({ at: o.placedAt })),
    range.days,
  )
  // Only orders placed through a tracked session convert sessions; imported and pre-tracking
  // orders would push the rate past 100%.
  const tracked = orders.filter((o) => o.channel !== null)
  const trackedPrev = ordersPrev.filter((o) => o.channel !== null)
  const allOrdersByDay = bucketByDay(
    tracked.map((o) => ({ at: o.placedAt })),
    range.days,
  )
  const conversion = conversionRate(tracked.length, sessions.length)
  const conversionPrev = conversionRate(trackedPrev.length, sessionsPrev.length)

  const kpis: MarketingKpi[] = [
    {
      id: 'sessions',
      value: sessions.length,
      previous: sessionsPrev.length,
      delta: delta(sessions.length, sessionsPrev.length),
      series: sessionsByDay,
    },
    {
      id: 'attributed_sales',
      value: sales,
      previous: salesPrev,
      delta: delta(sales, salesPrev),
      series: salesByDay,
    },
    {
      id: 'attributed_orders',
      value: attributed.length,
      previous: attributedPrev.length,
      delta: delta(attributed.length, attributedPrev.length),
      series: ordersByDay,
    },
    {
      id: 'conversion',
      value: conversion,
      previous: conversionPrev,
      delta: delta(conversion, conversionPrev),
      series: range.days.map((_, i) =>
        conversionRate(allOrdersByDay[i] ?? 0, sessionsByDay[i] ?? 0),
      ),
    },
  ]

  return {
    range: {
      key: range.key,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      days: range.days,
    },
    kpis,
    salesOverTime: {
      day: toDailyPoints(range.days, salesByDay),
      week: toWeeklyPoints(range.days, salesByDay),
    },
    channels: channelRows(sessions, orders),
    campaigns: await campaignRows(tx, sessions, orders),
  }
}
