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
import { type GrowthOutcomes, growthOutcomes } from './growth-outcomes.service'

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

/**
 * A source normalised to something a non-technical merchant recognises, so
 * the overview can answer "how much am I selling from Instagram/Google/
 * WhatsApp/ChatGPT/direct" without them knowing what a UTM parameter is.
 */
export const SOURCE_KEYS = [
  'instagram',
  'facebook',
  'youtube',
  'google',
  'whatsapp',
  'ai_assistant',
  'email',
  'direct',
  'other',
] as const
export type SourceKey = (typeof SOURCE_KEYS)[number]

export const SOURCE_LABELS: Record<SourceKey, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  google: 'Google',
  whatsapp: 'WhatsApp',
  ai_assistant: 'AI assistants',
  email: 'Email',
  direct: 'Direct',
  other: 'Other',
}

export type SourceRow = {
  source: SourceKey
  sessions: number
  orders: number
  salesPaise: number
  conversion: number
  /** Share of this range's total sales, 0 to 1. */
  shareOfSales: number
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
  /** The friendly source this campaign rolls up under, for the "by source" expandable rows. */
  sourceKey: SourceKey
}

export type MarketingOverview = {
  range: { key: string; from: string; to: string; days: string[] }
  kpis: MarketingKpi[]
  salesOverTime: { day: SeriesPoint[]; week: SeriesPoint[] }
  channels: ChannelRow[]
  sources: SourceRow[]
  /** The best-performing non-direct, non-other source this period, or null with too little data. */
  bestSource: SourceKey | null
  campaigns: CampaignRow[]
  /** What marketing earned: campaigns, automations, discounts and links (Figma outcomes). */
  outcomes: GrowthOutcomes
}

const TOP_CAMPAIGNS = 10
const counted = and(ne(order.status, 'draft'), ne(order.status, 'cancelled'))

type SessionRow = {
  channel: string
  source: string | null
  medium: string | null
  referrer: string | null
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
  referrer: string | null
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
      referrer: marketingSession.referrer,
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
      referrer: sql<string | null>`${order.attribution}->>'referrer'`,
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

/**
 * Normalises a source/medium/channel/referrer combination to a name a
 * non-technical merchant recognises. UTM tags win (a merchant who tagged
 * "instagram" meant Instagram); the channel and referrer are the fallback
 * for untagged organic and AI-assistant traffic.
 */
export function normalizeSource(input: {
  source: string | null
  medium: string | null
  referrer: string | null
  channel: string | null
}): SourceKey {
  const source = input.source?.toLowerCase() ?? ''
  const medium = input.medium?.toLowerCase() ?? ''
  const referrer = input.referrer?.toLowerCase() ?? ''
  const has = (needle: string) => source.includes(needle) || referrer.includes(needle)
  if (has('instagram') || source === 'ig') return 'instagram'
  if (has('facebook') || source === 'fb' || source === 'meta') return 'facebook'
  if (has('youtube') || source === 'yt') return 'youtube'
  if (has('google') || source === 'adwords' || source === 'googleads') return 'google'
  if (has('whatsapp') || source === 'wa' || medium === 'whatsapp' || input.channel === 'whatsapp')
    return 'whatsapp'
  if (
    has('chatgpt') ||
    has('openai') ||
    has('perplexity') ||
    has('gemini') ||
    has('claude.ai') ||
    has('copilot.microsoft') ||
    input.channel === 'ai_assistant'
  )
    return 'ai_assistant'
  if (has('mail.') || medium === 'email' || medium === 'newsletter' || input.channel === 'email')
    return 'email'
  if (!input.channel || input.channel === 'direct') return 'direct'
  return 'other'
}

/** Aggregates every session and order (attributed or not) by friendly source. */
function sourceRows(sessions: SessionRow[], orders: AttributedOrder[]): SourceRow[] {
  const by = new Map<SourceKey, SourceRow>()
  const get = (source: SourceKey) => {
    let row = by.get(source)
    if (!row) {
      row = { source, sessions: 0, orders: 0, salesPaise: 0, conversion: 0, shareOfSales: 0 }
      by.set(source, row)
    }
    return row
  }
  for (const s of sessions) get(normalizeSource(s)).sessions += 1
  let totalSales = 0
  for (const o of orders) {
    const row = get(normalizeSource(o))
    row.orders += 1
    row.salesPaise += o.totalPaise
    totalSales += o.totalPaise
  }
  return [...by.values()]
    .map((r) => ({
      ...r,
      conversion: conversionRate(r.orders, r.sessions),
      shareOfSales: totalSales > 0 ? r.salesPaise / totalSales : 0,
    }))
    .sort((a, b) => b.salesPaise - a.salesPaise || b.sessions - a.sessions)
}

/** The best source this period to feature in the "best source" callout. */
function bestSource(rows: SourceRow[]): SourceKey | null {
  const candidate = rows
    .filter((r) => r.source !== 'direct' && r.source !== 'other' && r.salesPaise > 0)
    .sort((a, b) => b.salesPaise - a.salesPaise)[0]
  return candidate?.source ?? null
}

/** Which friendly source a campaign row rolls up under, for the "by source" drilldown. */
function campaignSourceKey(
  kind: CampaignRow['kind'],
  source: string | null,
  medium: string | null,
): SourceKey {
  if (kind === 'whatsapp') return 'whatsapp'
  if (kind === 'email') return 'email'
  if (kind === 'automation') return medium?.toLowerCase() === 'whatsapp' ? 'whatsapp' : 'email'
  return normalizeSource({ source, medium, referrer: null, channel: null })
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
        sourceKey: campaignSourceKey('utm', r.source, r.medium),
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
      Object.assign(row, {
        kind: c.kind,
        name: c.name,
        href: `/growth/campaigns/${c.id}`,
        sourceKey: campaignSourceKey(c.kind, row.source, row.medium),
      })
  }
  for (const a of automations) {
    const row = by.get(`our:a:${a.id}`)
    if (row)
      Object.assign(row, {
        kind: 'automation',
        name: a.name,
        href: `/growth/automations/${a.id}`,
        sourceKey: campaignSourceKey('automation', row.source, row.medium),
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
  const sources = sourceRows(sessions, orders)
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
    sources,
    bestSource: bestSource(sources),
    campaigns: await campaignRows(tx, sessions, orders),
    outcomes: await growthOutcomes(tx, range, opts.now ?? new Date()),
  }
}
