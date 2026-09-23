import type { StoreTx } from '@commerce/db'
import { address, order, refund, shipment } from '@commerce/db'
import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { notDraft, placedIn, type ReportSpan } from './types'

/** One placed order with everything the order-level reports group by. */
export type OrderFact = {
  id: string
  placedAt: Date
  status: string
  cancelled: boolean
  customerId: string | null
  email: string | null
  paymentMethod: string | null
  subtotalPaise: number
  discountPaise: number
  shippingPaise: number
  adjustmentPaise: number
  totalPaise: number
  taxPaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  stateCode: string | null
  pincode: string | null
  city: string | null
  /** Marketing channel and UTM tags from the order's attribution; null before tracking. */
  channel: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
}

const taxPart = (key: string) =>
  sql<number>`coalesce((${order.taxBreakdown} ->> ${key})::int, 0)`.mapWith(Number)

/** Every non-draft order placed in the span, cancelled ones flagged rather than dropped. */
export async function orderFacts(tx: StoreTx, span: ReportSpan): Promise<OrderFact[]> {
  const rows = await tx
    .select({
      id: order.id,
      placedAt: order.placedAt,
      status: order.status,
      customerId: order.customerId,
      email: order.email,
      paymentMethod: order.paymentMethod,
      subtotalPaise: order.subtotalPaise,
      discountPaise: order.discountPaise,
      shippingPaise: order.shippingPaise,
      adjustmentPaise: order.paymentAdjustmentPaise,
      totalPaise: order.totalPaise,
      taxPaise: order.taxPaise,
      cgstPaise: taxPart('cgstPaise'),
      sgstPaise: taxPart('sgstPaise'),
      igstPaise: taxPart('igstPaise'),
      stateCode: address.stateCode,
      pincode: address.pincode,
      city: address.city,
      channel: sql<string | null>`${order.attribution} ->> 'channel'`,
      utmSource: sql<string | null>`${order.attribution} ->> 'source'`,
      utmMedium: sql<string | null>`${order.attribution} ->> 'medium'`,
      utmCampaign: sql<string | null>`${order.attribution} ->> 'campaign'`,
    })
    .from(order)
    .leftJoin(address, eq(address.id, order.shippingAddressId))
    .where(and(notDraft, placedIn(span)))
  return rows.map((r) => ({ ...r, cancelled: r.status === 'cancelled' }))
}

export type RefundFact = { orderId: string; at: Date; amountPaise: number; reason: string | null }

/** Refunds that actually returned money (gateway processed or settled by hand) in the span. */
export async function refundFacts(tx: StoreTx, span: ReportSpan): Promise<RefundFact[]> {
  return tx
    .select({
      orderId: refund.orderId,
      at: refund.createdAt,
      amountPaise: refund.amountPaise,
      reason: refund.reason,
    })
    .from(refund)
    .where(
      and(
        inArray(refund.status, ['processed', 'manual']),
        gte(refund.createdAt, span.from),
        lt(refund.createdAt, span.to),
      ),
    )
}

export type ShipmentFact = {
  orderId: string
  placedAt: Date
  paymentMethod: string | null
  courier: string
  status: string
  createdAt: Date
  deliveredAt: Date | null
  stateCode: string | null
  pincode: string | null
  city: string | null
}

/** First delivered event in the courier's tracking; the row's last update when there is none. */
const deliveredAt = sql<Date | null>`case when ${shipment.status} = 'delivered' then coalesce(
  (select min((e ->> 'at')::timestamptz) from jsonb_array_elements(coalesce(${shipment.tracking} -> 'events', '[]'::jsonb)) e
    where e ->> 'status' = 'delivered'),
  ${shipment.updatedAt}) end`

/** Live consignments for orders placed in the span; cancelled labels are not shipments. */
export async function shipmentFacts(tx: StoreTx, span: ReportSpan): Promise<ShipmentFact[]> {
  const rows = await tx
    .select({
      orderId: order.id,
      placedAt: order.placedAt,
      paymentMethod: order.paymentMethod,
      courier: shipment.provider,
      status: shipment.status,
      createdAt: shipment.createdAt,
      deliveredAt,
      stateCode: address.stateCode,
      pincode: address.pincode,
      city: address.city,
    })
    .from(shipment)
    .innerJoin(order, eq(order.id, shipment.orderId))
    .leftJoin(address, eq(address.id, order.shippingAddressId))
    .where(and(notDraft, placedIn(span), sql`${shipment.status} <> 'cancelled'`))
  return rows.map((r) => ({ ...r, deliveredAt: r.deliveredAt ? new Date(r.deliveredAt) : null }))
}
