import { notTestOrder } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  automationWorkflow,
  customer,
  marketingAutomation,
  marketingCampaign,
  marketingMessage,
  order,
  shortLink,
} from '@commerce/db'
import { and, count, eq, gte, lt, ne, sql } from 'drizzle-orm'

/** What earned the money: our campaigns, automations, discount codes and short links. */
export type OutcomeKind = 'campaigns' | 'automations' | 'discounts' | 'links'

export const OUTCOME_KINDS: OutcomeKind[] = ['campaigns', 'automations', 'discounts', 'links']

export type OutcomeRow = {
  kind: OutcomeKind
  orders: number
  revenuePaise: number
  /** The campaign, automation, discount or link that earned the most in the range. */
  top: { name: string; revenuePaise: number; href: string | null } | null
}

export type GrowthOutcomes = {
  /** Revenue of orders any of the four had a hand in, each order counted once. */
  earnedPaise: number
  earnedPrevPaise: number
  earnedOrders: number
  rows: OutcomeRow[]
  messages: { email: number; whatsapp: number }
  automationOrders: number
  subscribers: { total: number; newThisWeek: number }
}

/** One placed order and what it is credited to (`attribution` ids and the discount used). */
export type OutcomeOrder = {
  totalPaise: number
  campaignId: string | null
  automationId: string | null
  linkId: string | null
  discountKey: string | null
}

const counted = and(ne(order.status, 'draft'), ne(order.status, 'cancelled'), notTestOrder)

const keyOf: Record<OutcomeKind, (o: OutcomeOrder) => string | null> = {
  campaigns: (o) => o.campaignId,
  automations: (o) => o.automationId,
  discounts: (o) => o.discountKey,
  links: (o) => o.linkId,
}

/** Whether marketing had a hand in an order: any of the four kinds credits it. */
export const isEarned = (o: OutcomeOrder) => OUTCOME_KINDS.some((k) => keyOf[k](o) !== null)

/**
 * Orders and revenue per kind, and per item inside each kind (for the top performer). An
 * order can count under two kinds (a campaign email with a discount code), but `earned`
 * counts it once.
 */
export function outcomeTotals(orders: OutcomeOrder[]) {
  const perKind = new Map<
    OutcomeKind,
    { orders: number; revenuePaise: number; items: Map<string, number> }
  >(OUTCOME_KINDS.map((k) => [k, { orders: 0, revenuePaise: 0, items: new Map() }]))
  let earnedPaise = 0
  let earnedOrders = 0
  for (const o of orders) {
    if (isEarned(o)) {
      earnedPaise += o.totalPaise
      earnedOrders += 1
    }
    for (const kind of OUTCOME_KINDS) {
      const key = keyOf[kind](o)
      if (key === null) continue
      const bucket = perKind.get(kind)
      if (!bucket) continue
      bucket.orders += 1
      bucket.revenuePaise += o.totalPaise
      bucket.items.set(key, (bucket.items.get(key) ?? 0) + o.totalPaise)
    }
  }
  return { perKind, earnedPaise, earnedOrders }
}

/** The key with the most revenue (ties: the first seen). */
function topKey(items: Map<string, number>): [string, number] | null {
  let best: [string, number] | null = null
  for (const entry of items) if (!best || entry[1] > best[1]) best = entry
  return best
}

async function outcomeOrders(tx: StoreTx, from: Date, to: Date): Promise<OutcomeOrder[]> {
  const rows = await tx
    .select({
      totalPaise: order.totalPaise,
      campaignId: sql<string | null>`${order.attribution}->>'campaignId'`,
      automationId: sql<string | null>`${order.attribution}->>'automationId'`,
      linkId: sql<string | null>`${order.attribution}->>'linkId'`,
      discountId: order.discountId,
      discountCode: order.discountCode,
      discountLabel: order.discountLabel,
    })
    .from(order)
    .where(and(counted, gte(order.placedAt, from), lt(order.placedAt, to)))
  return rows.map((r) => ({
    totalPaise: r.totalPaise,
    campaignId: r.campaignId,
    automationId: r.automationId,
    linkId: r.linkId,
    // Shown by its code (or the automatic offer's label); grouped by that same text.
    discountKey: r.discountId ? (r.discountCode ?? r.discountLabel ?? r.discountId) : null,
  }))
}

/** Names and links for the top performers. */
async function namesFor(tx: StoreTx, ids: Record<OutcomeKind, string | null>) {
  const uuid = (v: string | null) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null)
  const [campaign, automation, link] = await Promise.all([
    uuid(ids.campaigns)
      ? tx
          .select({ name: marketingCampaign.name })
          .from(marketingCampaign)
          .where(eq(marketingCampaign.id, ids.campaigns as string))
      : [],
    // Growth automations live in automation_workflow once the store is on the engine (same ids).
    uuid(ids.automations)
      ? tx
          .select({ name: marketingAutomation.name })
          .from(marketingAutomation)
          .where(eq(marketingAutomation.id, ids.automations as string))
          .unionAll(
            tx
              .select({ name: automationWorkflow.name })
              .from(automationWorkflow)
              .where(eq(automationWorkflow.id, ids.automations as string)),
          )
      : [],
    uuid(ids.links)
      ? tx
          .select({ name: shortLink.name })
          .from(shortLink)
          .where(eq(shortLink.id, ids.links as string))
      : [],
  ])
  return {
    campaigns: campaign[0]
      ? { name: campaign[0].name, href: `/growth/campaigns/${ids.campaigns}` }
      : null,
    automations: automation[0]
      ? { name: automation[0].name, href: `/growth/automations/${ids.automations}` }
      : null,
    links: link[0] ? { name: link[0].name, href: '/growth/links' } : null,
    discounts: ids.discounts ? { name: ids.discounts, href: '/discounts' } : null,
  }
}

/**
 * Growth's outcomes summary (Figma "Marketing / Growth overview"): what marketing earned in a
 * range (and the one before, for the change), split into campaigns, automations, discounts
 * and links with each one's top performer, messages sent and subscribers.
 */
export async function growthOutcomes(
  tx: StoreTx,
  range: { from: Date; to: Date; previousFrom: Date; previousTo: Date },
  now = new Date(),
): Promise<GrowthOutcomes> {
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000)
  const [orders, ordersPrev, messages, subscribers, newSubscribers] = await Promise.all([
    outcomeOrders(tx, range.from, range.to),
    outcomeOrders(tx, range.previousFrom, range.previousTo),
    tx
      .select({ channel: marketingMessage.channel, n: count() })
      .from(marketingMessage)
      .where(
        and(
          eq(marketingMessage.status, 'sent'),
          gte(marketingMessage.sentAt, range.from),
          lt(marketingMessage.sentAt, range.to),
        ),
      )
      .groupBy(marketingMessage.channel),
    tx.select({ n: count() }).from(customer).where(eq(customer.acceptsMarketing, true)),
    tx
      .select({ n: count() })
      .from(customer)
      .where(and(eq(customer.acceptsMarketing, true), gte(customer.marketingConsentAt, weekAgo))),
  ])
  const current = outcomeTotals(orders)
  const previous = outcomeTotals(ordersPrev)
  const tops = Object.fromEntries(
    OUTCOME_KINDS.map((k) => [k, topKey(current.perKind.get(k)?.items ?? new Map())]),
  ) as Record<OutcomeKind, [string, number] | null>
  const names = await namesFor(
    tx,
    Object.fromEntries(OUTCOME_KINDS.map((k) => [k, tops[k]?.[0] ?? null])) as Record<
      OutcomeKind,
      string | null
    >,
  )
  const byChannel = new Map(messages.map((m) => [m.channel, Number(m.n)]))
  return {
    earnedPaise: current.earnedPaise,
    earnedPrevPaise: previous.earnedPaise,
    earnedOrders: current.earnedOrders,
    rows: OUTCOME_KINDS.map((kind) => {
      const bucket = current.perKind.get(kind)
      const top = tops[kind]
      const named = names[kind]
      return {
        kind,
        orders: bucket?.orders ?? 0,
        revenuePaise: bucket?.revenuePaise ?? 0,
        top: top && named ? { name: named.name, revenuePaise: top[1], href: named.href } : null,
      }
    }),
    messages: { email: byChannel.get('email') ?? 0, whatsapp: byChannel.get('whatsapp') ?? 0 },
    automationOrders: current.perKind.get('automations')?.orders ?? 0,
    subscribers: {
      total: Number(subscribers[0]?.n ?? 0),
      newThisWeek: Number(newSubscribers[0]?.n ?? 0),
    },
  }
}
