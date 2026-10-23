/** SOURCE OF TRUTH: growth report maths — WHAT: paid vs organic channels, first-time vs returning split, a campaign's funnel (sent → delivered → opened → visited → added to cart → ordered) and its rates, with "not reported" kept apart from zero / WHY: the overview, the campaign report and their tests must agree, and the admin needs these without a database import */
import type { MarketingChannel } from './attribution'

/** Channels a merchant pays for: the Paid filter on the overview's channel table. */
const PAID_CHANNELS: readonly MarketingChannel[] = ['paid_search', 'paid_social', 'other_paid']

/** `untracked` (no beacon) is neither paid nor organic; it only shows under All. */
export type ChannelFilter = 'all' | 'paid' | 'organic'

export function channelMatches(channel: string, filter: ChannelFilter): boolean {
  if (filter === 'all') return true
  if (channel === 'untracked') return false
  const paid = (PAID_CHANNELS as readonly string[]).includes(channel)
  return filter === 'paid' ? paid : !paid
}

/** Orders and sales from first-time buyers and from buyers who had ordered before. */
export type CustomerSplit = {
  newOrders: number
  newSalesPaise: number
  returningOrders: number
  returningSalesPaise: number
}

export const EMPTY_SPLIT: CustomerSplit = {
  newOrders: 0,
  newSalesPaise: 0,
  returningOrders: 0,
  returningSalesPaise: 0,
}

/** Adds one order to a split in place. */
export function addToSplit(split: CustomerSplit, o: { totalPaise: number; returning: boolean }) {
  if (o.returning) {
    split.returningOrders += 1
    split.returningSalesPaise += o.totalPaise
  } else {
    split.newOrders += 1
    split.newSalesPaise += o.totalPaise
  }
}

export function splitByCustomerType(
  orders: { totalPaise: number; returning: boolean }[],
): CustomerSplit {
  const out = { ...EMPTY_SPLIT }
  for (const o of orders) addToSplit(out, o)
  return out
}

/**
 * A rate the report can show. `null` means the channel never tells us (no bounce webhooks,
 * no WhatsApp read receipts): the admin says "not reported by this channel", never 0%.
 */
export type ReportedRate = { part: number; whole: number; rate: number } | null

function reportedRate(part: number, whole: number): ReportedRate {
  return { part, whole, rate: whole > 0 ? part / whole : 0 }
}

export type CampaignFunnelStepId =
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'visited'
  | 'carted'
  | 'ordered'

export type CampaignFunnelStep = {
  id: CampaignFunnelStepId
  value: number
  /** Share of the step before it (the first step is 1). */
  ofPrevious: number
  /** Share of the first step. */
  ofFirst: number
}

/** What the database recorded for one campaign's messages, visits, carts and orders. */
export type CampaignCounts = {
  channel: 'email' | 'whatsapp'
  /** Handed to the provider: accepted (`sent`) or refused (`failed`). */
  attempted: number
  /** Accepted by the provider. */
  accepted: number
  /** First opens (pixel or click); email only. */
  opened: number
  /** Storefront sessions that began on one of the campaign's links. */
  visits: number
  /** Carts stamped with the campaign; null when carts are not tracked. */
  carts: number | null
  orders: number
  /** Recipients who unsubscribed within the window after the send; null when not tracked. */
  unsubscribed: number | null
}

/**
 * The campaign funnel. Steps the channel cannot measure are left out (WhatsApp opens, carts
 * when untracked) and listed in `omitted`, so the report can say why.
 */
export function campaignFunnel(c: CampaignCounts): {
  steps: CampaignFunnelStep[]
  omitted: CampaignFunnelStepId[]
} {
  const raw: { id: CampaignFunnelStepId; value: number | null }[] = [
    { id: 'sent', value: c.attempted },
    { id: 'delivered', value: c.accepted },
    { id: 'opened', value: c.channel === 'email' ? c.opened : null },
    { id: 'visited', value: c.visits },
    { id: 'carted', value: c.carts },
    { id: 'ordered', value: c.orders },
  ]
  const omitted = raw.filter((s) => s.value === null).map((s) => s.id)
  const kept = raw.filter((s): s is { id: CampaignFunnelStepId; value: number } => s.value !== null)
  const first = kept[0]?.value ?? 0
  const steps = kept.map((s, i) => {
    const previous = i === 0 ? s.value : (kept[i - 1]?.value ?? 0)
    return {
      id: s.id,
      value: s.value,
      ofPrevious: i === 0 ? 1 : previous > 0 ? s.value / previous : 0,
      ofFirst: first > 0 ? s.value / first : 0,
    }
  })
  return { steps, omitted }
}

export type CampaignRates = {
  delivery: ReportedRate
  /** Async bounces: no provider reports them back to the store yet. */
  bounce: ReportedRate
  unsubscribe: ReportedRate
  /** Spam complaints: not reported back by any provider yet. */
  complaint: ReportedRate
  /** An estimate: Apple Mail Privacy Protection opens every image on delivery. */
  open: ReportedRate
}

export function campaignRates(c: CampaignCounts): CampaignRates {
  return {
    delivery: reportedRate(c.accepted, c.attempted),
    bounce: null,
    unsubscribe: c.unsubscribed === null ? null : reportedRate(c.unsubscribed, c.accepted),
    complaint: null,
    open: c.channel === 'email' ? reportedRate(c.opened, c.accepted) : null,
  }
}
