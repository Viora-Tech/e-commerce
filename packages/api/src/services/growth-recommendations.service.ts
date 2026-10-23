import {
  type AutomationState,
  abandonedStats,
  dismissGrowthRecommendation,
  type GrowthFacts,
  type GrowthRecommendation,
  growthRecommendationPrefs,
  growthRecommendations,
  type RecommendationId,
  visibleRecommendations,
} from '@commerce/core'
import {
  customer,
  marketingAutomation,
  marketingCampaign,
  order,
  type StoreTx,
  shortLink,
  shortLinkClickDay,
} from '@commerce/db'
import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm'

const DAY_MS = 86_400_000
/** The win-back template's default: no order for this many days. */
const LAPSED_DAYS = 90
const QUIET_LINKS = 5

/** Automation trigger → the fact key the rules read. */
const TRIGGER_FACT = {
  checkout_abandoned: 'abandoned_checkout',
  customer_subscribed: 'welcome_subscriber',
  customer_lapsed: 'win_back',
  cod_order_placed: 'cod_confirmation',
} as const

const counted = sql`${order.status} not in ('draft', 'cancelled') and ${order.isTest} = false`

async function automationStates(tx: StoreTx): Promise<GrowthFacts['automations']> {
  const rows = await tx
    .select({
      id: marketingAutomation.id,
      trigger: marketingAutomation.trigger,
      status: marketingAutomation.status,
    })
    .from(marketingAutomation)
    .where(inArray(marketingAutomation.trigger, Object.keys(TRIGGER_FACT)))
    .orderBy(desc(marketingAutomation.updatedAt))
  const out: GrowthFacts['automations'] = {
    abandoned_checkout: { status: 'missing' },
    welcome_subscriber: { status: 'missing' },
    win_back: { status: 'missing' },
    cod_confirmation: { status: 'missing' },
  }
  for (const r of rows) {
    const key = TRIGGER_FACT[r.trigger as keyof typeof TRIGGER_FACT]
    const current: AutomationState = out[key]
    // One live automation is enough; otherwise point at the newest paused one.
    if (current.status === 'active') continue
    if (r.status === 'active' || current.status === 'missing') {
      out[key] = { status: r.status, id: r.id }
    }
  }
  return out
}

const subscribed = and(eq(customer.acceptsMarketing, true), isNull(customer.unsubscribedAt))

/** The store numbers the recommendation rules read (core `growthRecommendations`). */
async function growthFacts(tx: StoreTx, storeId: string, now = new Date()): Promise<GrowthFacts> {
  const ago = (days: number) => new Date(now.getTime() - days * DAY_MS)
  const [
    automations,
    abandoned,
    subs,
    lapsed,
    orders30,
    lastCampaign,
    pending,
    subscribers,
    quietLinks,
  ] = await Promise.all([
    automationStates(tx),
    abandonedStats({ tx, storeId }, { days: 7, now }),
    tx
      .select({
        last30: sql<number>`count(*) filter (where ${customer.marketingConsentAt} >= ${ago(30).toISOString()}::timestamptz)::int`,
        previous30: sql<number>`count(*) filter (where ${customer.marketingConsentAt} >= ${ago(60).toISOString()}::timestamptz and ${customer.marketingConsentAt} < ${ago(30).toISOString()}::timestamptz)::int`,
      })
      .from(customer)
      .where(subscribed),
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(customer)
      .where(
        and(
          subscribed,
          sql`(select max(o.placed_at) from "order" o where o.customer_id = ${customer.id} and o.status not in ('draft', 'cancelled') and o.is_test = false) < ${ago(LAPSED_DAYS).toISOString()}::timestamptz`,
        ),
      ),
    tx
      .select({
        total: sql<number>`count(*)::int`,
        cod: sql<number>`count(*) filter (where ${order.paymentMethod} = 'cod')::int`,
      })
      .from(order)
      .where(and(counted, gte(order.placedAt, ago(30)), lt(order.placedAt, now))),
    tx
      .select({ at: sql<Date | null>`max(${marketingCampaign.finishedAt})` })
      .from(marketingCampaign)
      .where(eq(marketingCampaign.status, 'sent')),
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(marketingCampaign)
      .where(inArray(marketingCampaign.status, ['scheduled', 'sending'])),
    tx.select({ n: sql<number>`count(*)::int` }).from(customer).where(subscribed),
    tx
      .select({
        id: shortLink.id,
        name: shortLink.name,
        clicks: sql<number>`sum(${shortLinkClickDay.clicks})::int`,
      })
      .from(shortLinkClickDay)
      .innerJoin(shortLink, eq(shortLink.id, shortLinkClickDay.linkId))
      .where(
        and(
          gte(shortLinkClickDay.day, ago(30).toISOString().slice(0, 10)),
          sql`not exists (select 1 from "order" o where o.attribution ->> 'linkId' = ${shortLink.id}::text and o.status not in ('draft', 'cancelled'))`,
        ),
      )
      .groupBy(shortLink.id, shortLink.name)
      .orderBy(desc(sql`sum(${shortLinkClickDay.clicks})`))
      .limit(QUIET_LINKS),
  ])
  const lastAt = lastCampaign[0]?.at ? new Date(lastCampaign[0].at) : null
  return {
    automations,
    abandoned: { carts: abandoned.notRecovered, valuePaise: abandoned.valuePaise },
    newSubscribers: { last30: subs[0]?.last30 ?? 0, previous30: subs[0]?.previous30 ?? 0 },
    lapsedCustomers: lapsed[0]?.n ?? 0,
    orders30: { total: orders30[0]?.total ?? 0, cod: orders30[0]?.cod ?? 0 },
    daysSinceCampaign: lastAt ? Math.floor((now.getTime() - lastAt.getTime()) / DAY_MS) : null,
    campaignPending: (pending[0]?.n ?? 0) > 0,
    subscribers: subscribers[0]?.n ?? 0,
    quietLinks,
  }
}

/** Up to three recommendations for the Growth overview, minus the ones the store dismissed. */
export async function recommendationsFor(
  tx: StoreTx,
  storeId: string,
  now = new Date(),
): Promise<GrowthRecommendation[]> {
  const [facts, prefs] = await Promise.all([
    growthFacts(tx, storeId, now),
    growthRecommendationPrefs(tx, storeId),
  ])
  return visibleRecommendations(growthRecommendations(facts), new Set(Object.keys(prefs.dismissed)))
}

/** Dismisses one card for the whole store, then returns what the card now shows. */
export async function dismissRecommendation(
  tx: StoreTx,
  storeId: string,
  id: RecommendationId,
): Promise<GrowthRecommendation[]> {
  await dismissGrowthRecommendation(tx, storeId, id)
  return recommendationsFor(tx, storeId)
}
