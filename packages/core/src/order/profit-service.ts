/** SOURCE OF TRUTH: profitFacts, orderProfit, setCourierCharge, saveProfitCosts, feeGstClaimable
 * WHAT:  Loads what PROFIT_FORMULA (order/profit.ts) needs for a set of orders, in a few
 *        queries, and the two writes profit depends on (a courier charge typed by hand, the
 *        store's fee rates).
 * WHY:   The order page needs one order's profit; the Profit reports need hundreds at once.
 *        Both read the same facts so the card and the report always agree.
 * WHERE: `orders.profit`, `orders.setCourierCharge`, `profitCosts.*`; api reports/profit.ts.
 */
import {
  gstRegistration,
  order,
  orderLine,
  payment,
  refund,
  returnRequest,
  returnRequestLine,
  type StoreTx,
  shipment,
  store,
} from '@commerce/db'
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { parsePaymentSettings } from '../payments/settings'
import {
  computeOrderProfit,
  FEE_FREE_METHODS,
  METHOD_RATE_GATEWAYS,
  type OrderProfit,
  type ProfitCostSettings,
  ProfitCostSettingsSchema,
  type ProfitInput,
  parseMethodDetail,
  parseProfitCosts,
  withProfitCosts,
} from './profit'

/** One order line as profit by product needs it. */
export type ProfitFactLine = ProfitInput['lines'][number] & {
  orderLineId: string
  variantId: string
  grossPaise: number
}

/** Everything about one order that PROFIT_FORMULA reads, before the store's fee rates. */
export type ProfitFacts = Omit<ProfitInput, 'costs' | 'lines'> & {
  orderId: string
  placedAt: Date
  lines: ProfitFactLine[]
}

/** Payment rows that took money (a later full refund keeps the gateway's fee). */
const TOOK_MONEY = ['captured', 'refunded'] as const
const CHUNK = 500

/** Facts for these orders, in the order given; missing ids are left out. Reads under RLS. */
export async function profitFacts(
  tx: StoreTx,
  orderIds: readonly string[],
): Promise<ProfitFacts[]> {
  const out: ProfitFacts[] = []
  for (let i = 0; i < orderIds.length; i += CHUNK) {
    out.push(...(await factsFor(tx, orderIds.slice(i, i + CHUNK))))
  }
  return out
}

/**
 * The store can claim back the GST gateways and couriers charge on their fees: it holds a
 * regular (not composition) GST registration that is not cancelled, or, from before
 * registrations, a GSTIN on the store.
 */
export async function feeGstClaimable(tx: StoreTx, storeId: string): Promise<boolean> {
  const regs = await tx
    .select({ type: gstRegistration.registrationType })
    .from(gstRegistration)
    .where(and(eq(gstRegistration.storeId, storeId), isNull(gstRegistration.cancelledAt)))
  if (regs.length > 0) return regs.some((r) => r.type === 'regular')
  const [s] = await tx.select({ gstin: store.gstin }).from(store).where(eq(store.id, storeId))
  return Boolean(s?.gstin)
}

async function factsFor(tx: StoreTx, ids: string[]): Promise<ProfitFacts[]> {
  if (ids.length === 0) return []
  const orders = await tx
    .select({
      id: order.id,
      storeId: order.storeId,
      status: order.status,
      placedAt: order.placedAt,
      totalPaise: order.totalPaise,
      taxPaise: order.taxPaise,
    })
    .from(order)
    .where(inArray(order.id, ids))
  const lines = await tx
    .select({
      id: orderLine.id,
      orderId: orderLine.orderId,
      variantId: orderLine.variantId,
      quantity: orderLine.quantity,
      unitPricePaise: orderLine.unitPricePaise,
      costAtSalePaise: orderLine.costAtSalePaise,
      costEstimated: orderLine.costEstimated,
      giftCard: orderLine.giftCard,
    })
    .from(orderLine)
    .where(inArray(orderLine.orderId, ids))
  const restocked = await tx
    .select({
      orderLineId: returnRequestLine.orderLineId,
      units: sql<number>`sum(${returnRequestLine.restockedQuantity})::int`,
    })
    .from(returnRequestLine)
    .innerJoin(returnRequest, eq(returnRequest.id, returnRequestLine.returnRequestId))
    .where(inArray(returnRequest.orderId, ids))
    .groupBy(returnRequestLine.orderLineId)
  const refunds = await tx
    .select({
      orderId: refund.orderId,
      paise: sql<number>`sum(${refund.amountPaise})::int`,
    })
    .from(refund)
    .where(and(inArray(refund.orderId, ids), ne(refund.status, 'failed')))
    .groupBy(refund.orderId)
  const shipments = await tx
    .select({ orderId: shipment.orderId, courierChargePaise: shipment.courierChargePaise })
    .from(shipment)
    .where(and(inArray(shipment.orderId, ids), ne(shipment.status, 'cancelled')))
  const payments = await tx
    .select({
      orderId: payment.orderId,
      provider: payment.provider,
      amountPaise: payment.amountPaise,
      feePaise: payment.feePaise,
      feeTaxPaise: payment.feeTaxPaise,
      methodDetail: payment.methodDetail,
    })
    .from(payment)
    .where(and(inArray(payment.orderId, ids), inArray(payment.status, [...TOOK_MONEY])))
  const rtos = await tx
    .select({ orderId: returnRequest.orderId, courierCostPaise: returnRequest.courierCostPaise })
    .from(returnRequest)
    .where(and(inArray(returnRequest.orderId, ids), eq(returnRequest.kind, 'rto')))
  const storeId = orders[0]?.storeId
  const claimable = storeId ? await feeGstClaimable(tx, storeId) : false
  const restockedOf = new Map(restocked.map((r) => [r.orderLineId, r.units]))
  const refundedOf = new Map(refunds.map((r) => [r.orderId, r.paise]))

  return ids.flatMap((id) => {
    const o = orders.find((x) => x.id === id)
    if (!o) return []
    const paid = payments.filter((p) => p.orderId === id)
    const returned = rtos.filter((r) => r.orderId === id)
    // Cancelled or sent back undelivered: it will not be paid in full, so count what was taken.
    const notCompleting = o.status === 'cancelled' || returned.length > 0
    return [
      {
        orderId: id,
        placedAt: o.placedAt,
        totalPaise: o.totalPaise,
        taxPaise: o.taxPaise,
        refundedPaise: refundedOf.get(id) ?? 0,
        collectedPaise: notCompleting ? paid.reduce((n, p) => n + p.amountPaise, 0) : null,
        lines: lines
          .filter((l) => l.orderId === id)
          .map((l) => ({
            orderLineId: l.id,
            variantId: l.variantId,
            grossPaise: l.quantity * l.unitPricePaise,
            quantity: l.quantity,
            restockedQuantity: restockedOf.get(l.id) ?? 0,
            costAtSalePaise: l.costAtSalePaise,
            costEstimated: l.costEstimated,
            giftCard: l.giftCard,
          })),
        shipments: shipments
          .filter((s) => s.orderId === id)
          .map((s) => ({ courierChargePaise: s.courierChargePaise })),
        payments: paid.map((p) => ({
          provider: p.provider,
          amountPaise: p.amountPaise,
          feePaise: p.feePaise,
          feeTaxPaise: p.feeTaxPaise,
          method: parseMethodDetail(p.methodDetail),
        })),
        rtoPaise: returned.reduce((n, r) => n + (r.courierCostPaise ?? 0), 0),
        feeGstClaimable: claimable,
      },
    ]
  })
}

/** Settings › Costs for profit: the rates, and which methods take money so need one. */
export async function profitCostsView(tx: StoreTx, storeId: string) {
  const [s] = await tx
    .select({ apps: store.apps, payments: store.payments })
    .from(store)
    .where(eq(store.id, storeId))
  const enabled = parsePaymentSettings(s?.payments).enabled
  const gateways = enabled.filter((id) => id !== 'cod' && !FEE_FREE_METHODS.has(id))
  return {
    costs: parseProfitCosts(s?.apps),
    /** Online gateways switched on (cash on delivery and money paid to you directly take none). */
    gateways,
    /** Razorpay or Cashfree is on, so the rates by way of paying apply. */
    methodRatesOn: gateways.some((id) => METHOD_RATE_GATEWAYS.has(id)),
    codOn: enabled.includes('cod'),
    /** GST on fees is claimed back, so profit leaves it out. */
    gstClaimable: await feeGstClaimable(tx, storeId),
  }
}

/** The store's fee rates (Settings › Costs for profit). */
export async function profitCosts(tx: StoreTx, storeId: string): Promise<ProfitCostSettings> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  return parseProfitCosts(s?.apps)
}

export async function saveProfitCosts(
  tx: StoreTx,
  storeId: string,
  input: unknown,
): Promise<ProfitCostSettings> {
  const costs = ProfitCostSettingsSchema.parse(input)
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  await tx
    .update(store)
    .set({ apps: withProfitCosts(s?.apps, costs) })
    .where(eq(store.id, storeId))
  return costs
}

/** One order's profit; null when the store cannot see it. */
export async function orderProfit(ctx: StoreContext, orderId: string): Promise<OrderProfit | null> {
  const [facts] = await profitFacts(ctx.tx, [orderId])
  if (!facts) return null
  return computeOrderProfit({ ...facts, costs: await profitCosts(ctx.tx, ctx.storeId) })
}

export const CourierChargeInputSchema = z.object({
  shipmentId: z.uuid(),
  /** Null clears it (not known). */
  chargePaise: z.number().int().min(0).max(10_000_00).nullable(),
})

export class ShipmentNotFound extends CommerceError {
  constructor(id: string, storeId?: string) {
    super('SHIPMENT_NOT_FOUND', `Shipment ${id} not found`, { storeId })
  }
}

/** What the courier charged for a consignment, typed by the merchant. */
export async function setCourierCharge(
  ctx: StoreContext,
  raw: z.input<typeof CourierChargeInputSchema>,
): Promise<void> {
  const input = CourierChargeInputSchema.parse(raw)
  const [row] = await ctx.tx
    .update(shipment)
    .set({ courierChargePaise: input.chargePaise, updatedAt: new Date() })
    .where(eq(shipment.id, input.shipmentId))
    .returning({ id: shipment.id })
  if (!row) throw new ShipmentNotFound(input.shipmentId, ctx.storeId)
}
