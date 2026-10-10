/** SOURCE OF TRUTH: computeOrderProfit, PROFIT_FORMULA, ProfitCostSettingsSchema,
 *   parseProfitCosts, withProfitCosts, allocateProfit
 * WHAT:  What an order actually earned, and the fee rates the merchant pays that it needs.
 *        Pure, no database: safe for client components (`@commerce/core/profit`).
 * WHY:   Margin is what a merchant decides prices and ads on. Shopify cannot show it for
 *        imported goods because it has no landed cost; we do (inventory/landed-cost.ts).
 *        PROFIT_FORMULA, all integer paise:
 *          net sales   = what the shopper paid less refunds, without the GST inside it
 *                        ((total − refunded) × (total − GST) ÷ total, rounded half up); a
 *                        cancelled or RTO'd order counts only the money actually collected
 *          − goods     = each unit's cost at sale (`order_line.cost_at_sale_paise`, the
 *                        weighted average landed cost when it sold) for units not put back
 *                        in stock after a return
 *          − courier   = what the courier charged per live consignment
 *          − fees      = what the gateway kept (`payment.fee_paise` when reported, else the
 *                        store's rate for that method); cash on delivery pays the courier's
 *                        COD fee on the cash collected instead
 *          − RTO       = what couriers charged to bring undelivered parcels back
 *          = profit.   Anything unknown counts as zero and is flagged, never guessed.
 * WHERE: order/profit-service.ts loads the facts; the order page's Profit card and the
 *        Profit reports (Analytics) show the result.
 */
import { z } from 'zod'
import {
  type AppsSettings,
  appSettingsOf,
  parseAppsSettings,
  withAppSettings,
} from '../apps/settings'

/** A rate the store pays on money it takes: basis points of the amount plus a fixed sum. */
export const FeeRateSchema = z.object({
  /** 236 = 2.36%. */
  percentBps: z.number().int().min(0).max(10_000).default(0),
  fixedPaise: z.number().int().min(0).max(10_000_00).default(0),
})
export type FeeRate = z.infer<typeof FeeRateSchema>

/**
 * Settings › Costs for profit. `gatewayFees` by payment method id (razorpay, cashfree, …):
 * used when the gateway did not report its fee on the payment. `codFee`: what the courier
 * keeps for collecting cash on delivery.
 */
export const ProfitCostSettingsSchema = z.object({
  gatewayFees: z.record(z.string().min(1).max(40), FeeRateSchema).default({}),
  codFee: FeeRateSchema.nullable().default(null),
})
export type ProfitCostSettings = z.infer<typeof ProfitCostSettingsSchema>

export const defaultProfitCosts: ProfitCostSettings = ProfitCostSettingsSchema.parse({})

/** The core plugin's slot in `store.apps.settings`, beside its `tax` switches. */
const CORE_KEY = 'core'
const CoreEntrySchema = z.object({ profit: z.unknown().optional() }).catchall(z.unknown())

/** Profit cost rates from a raw `store.apps` blob; anything missing reads as none set. */
export function parseProfitCosts(appsRaw: unknown): ProfitCostSettings {
  const entry = CoreEntrySchema.safeParse(appSettingsOf(parseAppsSettings(appsRaw), CORE_KEY))
  const costs = ProfitCostSettingsSchema.safeParse(entry.success ? (entry.data.profit ?? {}) : {})
  return costs.success ? costs.data : defaultProfitCosts
}

/** `store.apps` with the profit cost rates replaced; every other entry is kept. */
export function withProfitCosts(appsRaw: unknown, profit: ProfitCostSettings): AppsSettings {
  const apps = parseAppsSettings(appsRaw)
  const entry = CoreEntrySchema.safeParse(appSettingsOf(apps, CORE_KEY))
  return withAppSettings(apps, CORE_KEY, { ...(entry.success ? entry.data : {}), profit })
}

/** Payment methods that take no fee here: store credit and money paid straight to the merchant. */
export const FEE_FREE_METHODS = new Set(['gift_card', 'manual'])

/** `amount × rate`, half up, plus the fixed part; nothing on nothing. */
export function feeOn(amountPaise: number, rate: FeeRate): number {
  if (amountPaise <= 0) return 0
  return Math.round((amountPaise * rate.percentBps) / 10_000) + rate.fixedPaise
}

export type ProfitLine = {
  quantity: number
  /** Units of this line a return put back in stock (they were not, in the end, sold). */
  restockedQuantity: number
  costAtSalePaise: number | null
  costEstimated: boolean
  giftCard: boolean
}

export type ProfitPayment = {
  provider: string
  /** Captured and kept (refunds are taken off net sales, not here). */
  amountPaise: number
  feePaise: number | null
}

export type ProfitInput = {
  totalPaise: number
  taxPaise: number
  refundedPaise: number
  /**
   * Money actually taken, for an order that will not be paid in full (cancelled, or sent back
   * undelivered): its net sales come from this instead of the order total. Null for a live order.
   */
  collectedPaise: number | null
  lines: readonly ProfitLine[]
  /** Consignments not cancelled; null charge = not known yet. */
  shipments: readonly { courierChargePaise: number | null }[]
  payments: readonly ProfitPayment[]
  /** What couriers charged for RTOs on this order. */
  rtoPaise: number
  costs: ProfitCostSettings
}

export type OrderProfit = {
  netSalesPaise: number
  goodsPaise: number
  courierPaise: number
  feesPaise: number
  rtoPaise: number
  profitPaise: number
  /** Profit as basis points of net sales; null with no net sales. */
  marginBps: number | null
  /** Why the figure may be off, in the merchant's terms. */
  flags: {
    /** Some units' cost was filled in after the sale from the cost then. */
    costEstimated: boolean
    /** Some goods had no cost at all: they count as free. */
    costMissing: boolean
    /** A consignment's courier charge is not known yet. */
    courierMissing: boolean
    /** A payment's fee came from the store's rate, not the gateway. */
    feeFromRate: boolean
    /** A payment's method has no rate set and the gateway reported no fee. */
    feeMissing: boolean
  }
}

/** PROFIT_FORMULA as a pure function: see the header. */
export function computeOrderProfit(input: ProfitInput): OrderProfit {
  const total = Math.max(0, input.totalPaise)
  const base = input.collectedPaise === null ? total : Math.min(total, input.collectedPaise)
  const kept = Math.max(0, base - Math.max(0, input.refundedPaise))
  const exGst = Math.max(0, total - Math.max(0, input.taxPaise))
  const netSalesPaise = total > 0 ? Math.round((kept * exGst) / total) : 0

  let goodsPaise = 0
  let costEstimated = false
  let costMissing = false
  for (const l of input.lines) {
    if (l.giftCard) continue
    const sold = Math.max(0, l.quantity - Math.max(0, l.restockedQuantity))
    if (sold === 0) continue
    if (l.costAtSalePaise === null) {
      costMissing = true
      continue
    }
    goodsPaise += sold * l.costAtSalePaise
    costEstimated ||= l.costEstimated
  }

  let courierPaise = 0
  let courierMissing = false
  for (const s of input.shipments) {
    if (s.courierChargePaise === null) courierMissing = true
    else courierPaise += s.courierChargePaise
  }

  let feesPaise = 0
  let feeFromRate = false
  let feeMissing = false
  for (const p of input.payments) {
    if (FEE_FREE_METHODS.has(p.provider) || p.amountPaise <= 0) continue
    if (p.feePaise !== null) {
      feesPaise += p.feePaise
      continue
    }
    const rate = p.provider === 'cod' ? input.costs.codFee : input.costs.gatewayFees[p.provider]
    if (!rate) {
      feeMissing = true
      continue
    }
    feesPaise += feeOn(p.amountPaise, rate)
    feeFromRate = true
  }

  const rtoPaise = Math.max(0, input.rtoPaise)
  const profitPaise = netSalesPaise - goodsPaise - courierPaise - feesPaise - rtoPaise
  return {
    netSalesPaise,
    goodsPaise,
    courierPaise,
    feesPaise,
    rtoPaise,
    profitPaise,
    marginBps: netSalesPaise > 0 ? Math.round((profitPaise * 10_000) / netSalesPaise) : null,
    flags: { costEstimated, costMissing, courierMissing, feeFromRate, feeMissing },
  }
}

/**
 * Split an order's profit over its lines (for profit by product): net sales by each line's
 * share of the goods value, its own goods cost, and the order's courier, fees and RTO by the
 * same share. Whole paise, largest remainder, so the lines add back to the order exactly.
 */
export function allocateProfit(
  profit: Pick<OrderProfit, 'netSalesPaise' | 'courierPaise' | 'feesPaise' | 'rtoPaise'>,
  lines: readonly { grossPaise: number; goodsPaise: number }[],
): { netSalesPaise: number; goodsPaise: number; profitPaise: number }[] {
  const weights = lines.map((l) => Math.max(0, l.grossPaise))
  const share = (amount: number) => largestRemainder(amount, weights)
  const net = share(profit.netSalesPaise)
  const overhead = share(profit.courierPaise + profit.feesPaise + profit.rtoPaise)
  return lines.map((l, i) => {
    const netSalesPaise = net[i] ?? 0
    return {
      netSalesPaise,
      goodsPaise: l.goodsPaise,
      profitPaise: netSalesPaise - l.goodsPaise - (overhead[i] ?? 0),
    }
  })
}

/** Split a signed amount by weights, whole paise, adding back exactly. */
function largestRemainder(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, w) => a + w, 0)
  if (weights.length === 0) return []
  if (sum === 0) return weights.map((_, i) => (i === 0 ? total : 0))
  const sign = total < 0 ? -1 : 1
  const abs = Math.abs(total)
  const exact = weights.map((w) => (w * abs) / sum)
  const parts = exact.map(Math.floor)
  let left = abs - parts.reduce((a, b) => a + b, 0)
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    parts[i] = (parts[i] ?? 0) + 1
    left--
  }
  return parts.map((p) => p * sign)
}
