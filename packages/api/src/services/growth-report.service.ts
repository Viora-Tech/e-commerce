import {
  type CampaignCounts,
  type CampaignFunnelStep,
  type CampaignFunnelStepId,
  type CampaignRates,
  type CustomerSplit,
  campaignFunnel,
  campaignRates,
  splitByCustomerType,
  utmName,
} from '@commerce/core/marketing'
import {
  cart,
  customer,
  marketingMessage,
  marketingSession,
  order,
  type StoreTx,
} from '@commerce/db'
import { and, eq, gte, isNotNull, or, type SQL, sql } from 'drizzle-orm'

/*
 * Written literally rather than with `${order.customerId}`: Drizzle renders an interpolated
 * column unqualified inside a projection subquery, which would bind to `prior` (see
 * core cart/abandoned.ts). Guests (no customer) count as first-time buyers.
 */
/** The order's customer had a counted order before it: a returning buyer. */
export const returningCustomer = sql<boolean>`exists (select 1 from "order" prior where prior.customer_id = "order".customer_id and prior.placed_at < "order".placed_at and prior.status not in ('draft', 'cancelled') and prior.is_test = false)`

/** Unsubscribes this long after a message was sent are put down to it. */
const UNSUBSCRIBE_WINDOW_DAYS = 7

/** Visits, orders and sales that began on one landing page of the campaign's links. */
export type CampaignLinkRow = {
  /** The page path the link led to, without its query string. */
  path: string
  visits: number
  orders: number
  salesPaise: number
}

export type CampaignReport = {
  funnel: CampaignFunnelStep[]
  /** Steps this channel cannot measure, so the report can say why they are missing. */
  omitted: CampaignFunnelStepId[]
  rates: CampaignRates
  /** Orders and sales from first-time vs returning buyers. */
  split: CustomerSplit
  links: CampaignLinkRow[]
}

const MAX_LINKS = 20
const pathOf = (landing: string | null) => (landing ?? '/').split(/[?#]/)[0] || '/'

type ReportCampaign = {
  id: string
  kind: 'email' | 'whatsapp'
  name: string
  startedAt: Date | null
}

/**
 * Funnel, rates, buyer split and landing pages for one sent campaign. A visit or order belongs
 * to it when it carries the campaign's id (a tracked email click) or its `utm_campaign` tag
 * (WhatsApp buttons, copied links), from the moment sending began.
 */
export async function campaignReport(tx: StoreTx, c: ReportCampaign): Promise<CampaignReport> {
  // Nothing can belong to a campaign that has not started sending.
  const since = c.startedAt ?? new Date()
  const tag = utmName(c.name)
  const attr = (key: string) => sql`${order.attribution} ->> ${key}`
  const ours = (idCol: SQL, tagCol: SQL) => sql`(${idCol} = ${c.id} or lower(${tagCol}) = ${tag})`
  const [messages, sessions, orders, carts, unsubscribed] = await Promise.all([
    tx
      .select({
        attempted: sql<number>`count(*) filter (where ${marketingMessage.status} in ('sent', 'failed'))::int`,
        accepted: sql<number>`count(*) filter (where ${marketingMessage.status} = 'sent')::int`,
        opened: sql<number>`count(${marketingMessage.openedAt})::int`,
      })
      .from(marketingMessage)
      .where(eq(marketingMessage.campaignId, c.id)),
    tx
      .select({ landing: marketingSession.landingPath })
      .from(marketingSession)
      .where(
        and(
          gte(marketingSession.startedAt, since),
          or(
            eq(marketingSession.campaignId, c.id),
            sql`lower(${marketingSession.campaign}) = ${tag}`,
          ),
        ),
      ),
    tx
      .select({
        totalPaise: order.totalPaise,
        landing: sql<string | null>`${attr('landing')}`,
        returning: returningCustomer,
      })
      .from(order)
      .where(
        and(
          gte(order.placedAt, since),
          ours(attr('campaignId'), attr('campaign')),
          sql`${order.status} not in ('draft', 'cancelled')`,
          eq(order.isTest, false),
        ),
      ),
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(cart)
      .where(
        and(
          gte(cart.createdAt, since),
          ours(sql`${cart.attribution} ->> 'campaignId'`, sql`${cart.attribution} ->> 'campaign'`),
        ),
      ),
    tx
      .select({ n: sql<number>`count(distinct ${customer.id})::int` })
      .from(marketingMessage)
      .innerJoin(customer, eq(customer.id, marketingMessage.customerId))
      .where(
        and(
          eq(marketingMessage.campaignId, c.id),
          eq(marketingMessage.status, 'sent'),
          isNotNull(customer.unsubscribedAt),
          sql`${customer.unsubscribedAt} >= ${marketingMessage.sentAt}`,
          sql`${customer.unsubscribedAt} < ${marketingMessage.sentAt} + make_interval(days => ${UNSUBSCRIBE_WINDOW_DAYS})`,
        ),
      ),
  ])
  const m = messages[0]
  const counts: CampaignCounts = {
    channel: c.kind,
    attempted: m?.attempted ?? 0,
    accepted: m?.accepted ?? 0,
    opened: m?.opened ?? 0,
    visits: sessions.length,
    carts: carts[0]?.n ?? 0,
    orders: orders.length,
    unsubscribed: unsubscribed[0]?.n ?? 0,
  }
  const { steps, omitted } = campaignFunnel(counts)
  return {
    funnel: steps,
    omitted,
    rates: campaignRates(counts),
    split: splitByCustomerType(orders),
    links: linkRows(sessions, orders),
  }
}

/** Visits and orders per landing page, busiest first. */
function linkRows(
  sessions: { landing: string | null }[],
  orders: { landing: string | null; totalPaise: number }[],
): CampaignLinkRow[] {
  const by = new Map<string, CampaignLinkRow>()
  const get = (landing: string | null) => {
    const path = pathOf(landing)
    let row = by.get(path)
    if (!row) {
      row = { path, visits: 0, orders: 0, salesPaise: 0 }
      by.set(path, row)
    }
    return row
  }
  for (const s of sessions) get(s.landing).visits += 1
  for (const o of orders) {
    const row = get(o.landing)
    row.orders += 1
    row.salesPaise += o.totalPaise
  }
  return [...by.values()]
    .sort((a, b) => b.visits - a.visits || b.salesPaise - a.salesPaise)
    .slice(0, MAX_LINKS)
}
