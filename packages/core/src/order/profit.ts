/** SOURCE OF TRUTH: computeOrderProfit, PROFIT_FORMULA, ProfitCostSettingsSchema,
 *   parseProfitCosts, withProfitCosts, allocateProfit, paymentFee, methodRateIdOf,
 *   STANDARD_METHOD_FEES
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
 *          − packing   = each parcel's box (order/profit-estimates.ts, PARCEL_COSTS)
 *          − courier   = what the courier charged per live consignment, else a cautious
 *                        estimate per parcel (PARCEL_COSTS)
 *          − fees      = what the gateway kept, per payment (paymentFee):
 *                        1. actual: `payment.fee_paise`, the gateway's own figure;
 *                        2. else the store's rate for how the shopper paid
 *                           (`payment.method_detail` → methodRateIdOf, Razorpay and Cashfree);
 *                        3. else the store's rate for that gateway;
 *                        cash on delivery pays the courier's COD fee on the cash collected.
 *                        Rates are before GST and 18% GST is added, as gateways bill it. The
 *                        GST on a fee is left out when the store can claim it back (a regular
 *                        GST registration), the same way net sales leave out GST
 *          − RTO       = what couriers charged to bring undelivered parcels back
 *          = profit.   Packing and delivery are estimated cautiously until known (a floor:
 *                      "at least"); anything else unknown counts as zero and is flagged.
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
import { DEFAULT_DELIVERY_PAISE, type ParcelCost } from './profit-estimates'

export * from './profit-estimates'

/** A rate the store pays on money it takes: basis points of the amount plus a fixed sum. */
export const FeeRateSchema = z.object({
  /** 236 = 2.36%. */
  percentBps: z.number().int().min(0).max(10_000).default(0),
  fixedPaise: z.number().int().min(0).max(10_000_00).default(0),
})
export type FeeRate = z.infer<typeof FeeRateSchema>

/** GST on a gateway's or courier's fee: 18%. Rates are typed before it, as gateways quote them. */
export const FEE_GST_BPS = 1_800

/** How a shopper paid, as Settings › Costs for profit prices it. */
export const METHOD_RATE_IDS = [
  'upi',
  'rupay_debit',
  'debit_card',
  'credit_card',
  'international_card',
  'corporate_card',
  'netbanking',
  'wallet',
  'emi',
  'pay_later',
] as const
export type MethodRateId = (typeof METHOD_RATE_IDS)[number]

const pct = (percentBps: number): FeeRate => ({ percentBps, fixedPaise: 0 })

/**
 * Razorpay's published standard rates, before 18% GST (https://razorpay.com/pricing/, read
 * 11 October 2026): 2% on every domestic method, 2.15% on corporate / business credit cards,
 * up to 3% on international cards, no fixed fee. Only a starting point: plans differ, so the
 * merchant checks theirs. Used until the store saves its own rates.
 */
export const STANDARD_METHOD_FEES: Record<MethodRateId, FeeRate> = {
  upi: pct(200),
  rupay_debit: pct(200),
  debit_card: pct(200),
  credit_card: pct(200),
  international_card: pct(300),
  corporate_card: pct(215),
  netbanking: pct(200),
  wallet: pct(200),
  emi: pct(200),
  pay_later: pct(200),
}

/** Gateways whose payments are priced by method; any other gateway uses its own rate. */
export const METHOD_RATE_GATEWAYS = new Set(['razorpay', 'razorpay_upi', 'cashfree'])

/** `payment.method_detail`, as the adapters write it (@commerce/payments PaymentMethodDetail). */
export const PaymentMethodDetailSchema = z.object({
  kind: z.enum(['upi', 'card', 'netbanking', 'wallet', 'emi', 'cardless_emi', 'paylater', 'other']),
  cardType: z.enum(['credit', 'debit', 'prepaid']).optional(),
  network: z.string().max(40).optional(),
  international: z.boolean().optional(),
  corporate: z.boolean().optional(),
  provider: z.string().max(120).optional(),
})
export type PaymentMethodDetail = z.infer<typeof PaymentMethodDetailSchema>

/** A stored method detail, or null when there is none or it does not parse. */
export function parseMethodDetail(raw: unknown): PaymentMethodDetail | null {
  const r = PaymentMethodDetailSchema.safeParse(raw)
  return r.success ? r.data : null
}

/**
 * Which rate prices this way of paying. International beats corporate (Amex, Diners and
 * business cards), which beats the card type; null when the gateway did not say enough.
 */
export function methodRateIdOf(m: PaymentMethodDetail | null): MethodRateId | null {
  if (!m) return null
  switch (m.kind) {
    case 'upi':
      return 'upi'
    case 'netbanking':
      return 'netbanking'
    case 'wallet':
      return 'wallet'
    case 'emi':
    case 'cardless_emi':
      return 'emi'
    case 'paylater':
      return 'pay_later'
    case 'card': {
      if (m.international) return 'international_card'
      if (m.corporate || m.network === 'amex' || m.network === 'diners') return 'corporate_card'
      if (m.cardType === 'debit' || m.cardType === 'prepaid') {
        return m.network === 'rupay' && m.cardType === 'debit' ? 'rupay_debit' : 'debit_card'
      }
      return m.cardType === 'credit' ? 'credit_card' : null
    }
    default:
      return null
  }
}

/**
 * Settings › Costs for profit, all before GST. `methodFees`: by how the shopper paid, for
 * Razorpay and Cashfree payments whose fee is not reported yet; missing from a saved store,
 * Razorpay's standard rates. `gatewayFees` by gateway id: when the way of paying is not known,
 * and for other gateways. `codFee`: what the courier keeps for collecting cash on delivery.
 */
export const ProfitCostSettingsSchema = z.object({
  methodFees: z
    .partialRecord(z.enum(METHOD_RATE_IDS), FeeRateSchema)
    .default(() => ({ ...STANDARD_METHOD_FEES })),
  gatewayFees: z.record(z.string().min(1).max(40), FeeRateSchema).default({}),
  codFee: FeeRateSchema.nullable().default(null),
  /**
   * What a parcel's delivery is estimated at when no real charge to its state is on record in
   * the last 60 days (order/profit-estimates.ts). Before GST when the store is registered.
   */
  defaultDeliveryPaise: z.number().int().min(0).max(10_000_00).default(DEFAULT_DELIVERY_PAISE),
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

/** Payment methods that take no fee here: gift cards, store credit and money paid straight to the merchant. */
export const FEE_FREE_METHODS = new Set(['gift_card', 'store_credit', 'manual'])

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
  /** What the gateway reported it kept, GST included; null when it has not yet. */
  feePaise: number | null
  /** The GST inside `feePaise`. */
  feeTaxPaise: number | null
  method: PaymentMethodDetail | null
}

/** Where a payment's fee came from: the gateway, a rate, nowhere (no rate), or none due. */
export type FeeSource = 'actual' | 'rate' | 'missing' | 'none'

/** One payment's fee as profit counts it (PROFIT_FORMULA, fees). */
export function paymentFee(
  p: ProfitPayment,
  costs: ProfitCostSettings,
  gstClaimable: boolean,
): { paise: number; source: FeeSource } {
  if (FEE_FREE_METHODS.has(p.provider) || p.amountPaise <= 0) return { paise: 0, source: 'none' }
  if (p.feePaise !== null) {
    const fee = Math.max(0, p.feePaise)
    const tax = Math.min(fee, Math.max(0, p.feeTaxPaise ?? 0))
    return { paise: gstClaimable ? fee - tax : fee, source: 'actual' }
  }
  const byMethod = METHOD_RATE_GATEWAYS.has(p.provider) ? methodRateIdOf(p.method) : null
  const rate =
    p.provider === 'cod'
      ? costs.codFee
      : ((byMethod ? costs.methodFees[byMethod] : undefined) ?? costs.gatewayFees[p.provider])
  if (!rate) return { paise: 0, source: 'missing' }
  const beforeGst = feeOn(p.amountPaise, rate)
  const gst = Math.round((beforeGst * FEE_GST_BPS) / 10_000)
  return { paise: gstClaimable ? beforeGst : beforeGst + gst, source: 'rate' }
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
  /** Each parcel's packing and delivery (order/profit-estimates.ts parcelCost). */
  parcels: readonly ParcelCost[]
  payments: readonly ProfitPayment[]
  /** What couriers charged for RTOs on this order. */
  rtoPaise: number
  costs: ProfitCostSettings
  /** The store can claim back GST on fees (a regular GST registration). */
  feeGstClaimable: boolean
}

export type OrderProfit = {
  netSalesPaise: number
  goodsPaise: number
  packingPaise: number
  courierPaise: number
  feesPaise: number
  rtoPaise: number
  profitPaise: number
  /** Profit as basis points of net sales; null with no net sales. */
  marginBps: number | null
  /**
   * Payment fees as the gateway reported them, estimated from the store's rates, a mix of the
   * two, or null when no payment took a fee.
   */
  feeSource: 'actual' | 'estimated' | 'mixed' | null
  /**
   * Some part will still change when the real figure arrives (packing, delivery or a payment
   * fee), so the profit is a floor: at least this much, from the costs entered.
   */
  estimated: boolean
  /** Why the figure may be off, in the merchant's terms. */
  flags: {
    /** Some units' cost was filled in after the sale from the cost then. */
    costEstimated: boolean
    /** Some goods had no cost at all: they count as free. */
    costMissing: boolean
    /** A consignment's courier charge is not known and could not be estimated. */
    courierMissing: boolean
    /** Some delivery is estimated until the courier's charge is known. */
    courierEstimated: boolean
    /** Some packing is the box's cost now, not a snapshot from when it was packed. */
    packingEstimated: boolean
    /** A parcel's box has no cost set (or the store has no boxes): packing counts as ₹0. */
    packingMissing: boolean
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

  let packingPaise = 0
  let courierPaise = 0
  let courierEstimated = false
  let packingEstimated = false
  let packingMissing = false
  for (const p of input.parcels) {
    packingPaise += Math.max(0, p.packingPaise)
    courierPaise += Math.max(0, p.courierPaise)
    courierEstimated ||= p.courierEstimated
    packingEstimated ||= p.packingEstimated
    packingMissing ||= p.packingMissing
  }

  let feesPaise = 0
  let feeActual = false
  let feeFromRate = false
  let feeMissing = false
  for (const p of input.payments) {
    const fee = paymentFee(p, input.costs, input.feeGstClaimable)
    feesPaise += fee.paise
    feeActual ||= fee.source === 'actual'
    feeFromRate ||= fee.source === 'rate'
    feeMissing ||= fee.source === 'missing'
  }
  const estimated = feeFromRate || feeMissing

  const rtoPaise = Math.max(0, input.rtoPaise)
  const profitPaise =
    netSalesPaise - goodsPaise - packingPaise - courierPaise - feesPaise - rtoPaise
  return {
    netSalesPaise,
    goodsPaise,
    packingPaise,
    courierPaise,
    feesPaise,
    rtoPaise,
    profitPaise,
    marginBps: netSalesPaise > 0 ? Math.round((profitPaise * 10_000) / netSalesPaise) : null,
    feeSource: feeActual ? (estimated ? 'mixed' : 'actual') : estimated ? 'estimated' : null,
    estimated: courierEstimated || packingEstimated || feeFromRate,
    flags: {
      costEstimated,
      costMissing,
      courierMissing: false,
      courierEstimated,
      packingEstimated,
      packingMissing,
      feeFromRate,
      feeMissing,
    },
  }
}

/**
 * Split an order's profit over its lines (for profit by product): net sales by each line's
 * share of the goods value, its own goods cost, and the order's packing, courier, fees and RTO
 * by the same share. Whole paise, largest remainder, so the lines add back to the order exactly.
 */
export function allocateProfit(
  profit: Pick<OrderProfit, 'netSalesPaise' | 'courierPaise' | 'feesPaise' | 'rtoPaise'> & {
    packingPaise?: number
  },
  lines: readonly { grossPaise: number; goodsPaise: number }[],
): { netSalesPaise: number; goodsPaise: number; profitPaise: number }[] {
  const weights = lines.map((l) => Math.max(0, l.grossPaise))
  const share = (amount: number) => largestRemainder(amount, weights)
  const net = share(profit.netSalesPaise)
  const overhead = share(
    (profit.packingPaise ?? 0) + profit.courierPaise + profit.feesPaise + profit.rtoPaise,
  )
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
