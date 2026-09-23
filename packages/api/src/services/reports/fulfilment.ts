import { inventoryAdjustment, product, variant } from '@commerce/db'
import { and, eq, gte, lt } from 'drizzle-orm'
import { istIsoDate } from '../analytics-buckets'
import { orderFacts, refundFacts, type ShipmentFact, shipmentFacts } from './facts'
import { lineFacts, variantLabel } from './sales'
import {
  byDesc,
  groupBy,
  mean,
  type ReportBuilder,
  type ReportRow,
  type ReportValue,
  ratio,
  sumOf,
  withShare,
} from './types'

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
const PINCODE_ROWS = 200

/** Placed-to-label hours and placed-to-delivered days; null when nothing qualifies. */
function speed(group: ShipmentFact[]): {
  dispatchHours: number | null
  deliveryDays: number | null
} {
  const dispatch = mean(group.map((s) => (s.createdAt.getTime() - s.placedAt.getTime()) / HOUR_MS))
  const delivery = mean(
    group
      .filter((s) => s.deliveredAt)
      .map((s) => ((s.deliveredAt as Date).getTime() - s.placedAt.getTime()) / DAY_MS),
  )
  return { dispatchHours: dispatch, deliveryDays: delivery }
}

/**
 * Outcome counts for a set of shipments. The RTO rate is over closed shipments
 * (delivered or returned) so parcels still moving do not flatter it.
 */
function outcome(group: ShipmentFact[]): Record<string, ReportValue> {
  const delivered = group.filter((s) => s.status === 'delivered').length
  const rto = group.filter((s) => s.status === 'rto').length
  return {
    shipments: group.length,
    delivered,
    rto,
    inTransit: group.length - delivered - rto,
    rtoRate: ratio(rto, delivered + rto),
  }
}

const rtoReport =
  (
    keyOf: (s: ShipmentFact) => string,
    label: (s: ShipmentFact) => Record<string, ReportValue>,
    limit?: number,
  ): ReportBuilder =>
  async (tx, span) => {
    const shipments = await shipmentFacts(tx, span)
    const rows: ReportRow[] = [...groupBy(shipments, keyOf)]
      .map(([key, group]) => ({
        key,
        values: { ...label(group[0] as ShipmentFact), ...outcome(group) },
      }))
      .sort((a, b) => byDesc('rto')(a, b) || byDesc('shipments')(a, b))
    return { rows: limit ? rows.slice(0, limit) : rows, totals: outcome(shipments) }
  }

export const fulfilmentBuilders: Record<string, ReportBuilder> = {
  'fulfilment-time': async (tx, span) => {
    const orders = (await orderFacts(tx, span)).filter((o) => !o.cancelled)
    const shipments = await shipmentFacts(tx, span)
    const ordersByDay = groupBy(orders, (o) => istIsoDate(o.placedAt))
    const shipmentsByDay = groupBy(shipments, (s) => istIsoDate(s.placedAt))
    return {
      rows: span.days.map((d) => {
        const mine = shipmentsByDay.get(d) ?? []
        return {
          key: d,
          values: {
            day: d,
            orders: ordersByDay.get(d)?.length ?? 0,
            shipments: mine.length,
            delivered: mine.filter((s) => s.status === 'delivered').length,
            ...speed(mine),
          },
        }
      }),
      totals: {
        orders: orders.length,
        shipments: shipments.length,
        delivered: shipments.filter((s) => s.status === 'delivered').length,
        ...speed(shipments),
      },
    }
  },

  'shipping-by-courier': async (tx, span) => {
    const shipments = await shipmentFacts(tx, span)
    const row = (group: ShipmentFact[]) => ({ ...outcome(group), ...speed(group) })
    return {
      rows: [...groupBy(shipments, (s) => s.courier)]
        .map(([courier, group]) => ({ key: courier, values: { courier, ...row(group) } }))
        .sort(byDesc('shipments')),
      totals: row(shipments),
    }
  },

  'rto-by-state': rtoReport(
    (s) => s.stateCode ?? '',
    (s) => ({ state: s.stateCode }),
  ),
  'rto-by-pincode': rtoReport(
    (s) => s.pincode ?? '',
    (s) => ({ pincode: s.pincode, city: s.city, state: s.stateCode }),
    PINCODE_ROWS,
  ),
  'rto-by-payment': rtoReport(
    (s) => s.paymentMethod ?? '',
    (s) => ({ method: s.paymentMethod }),
  ),

  'refunds-by-reason': async (tx, span) => {
    const refunds = await refundFacts(tx, span)
    const total = sumOf(refunds, (r) => r.amountPaise)
    const rows = [...groupBy(refunds, (r) => r.reason?.trim().toLowerCase() ?? '')].map(
      ([key, group]) => ({
        key,
        values: {
          reason: group[0]?.reason?.trim() || null,
          refunds: group.length,
          orders: new Set(group.map((r) => r.orderId)).size,
          refunded: sumOf(group, (r) => r.amountPaise),
        },
      }),
    )
    return {
      rows: withShare(rows, 'refunded', total).sort(byDesc('refunded')),
      totals: {
        refunds: refunds.length,
        orders: new Set(refunds.map((r) => r.orderId)).size,
        refunded: total,
        share: refunds.length > 0 ? 1 : null,
      },
    }
  },

  /** Returns are recorded when stock comes back: inventory adjustments with reason `returned`. */
  'returns-by-product': async (tx, span) => {
    const returned = await tx
      .select({
        variantId: variant.id,
        productTitle: product.title,
        variantTitle: variant.title,
        sku: variant.sku,
        delta: inventoryAdjustment.delta,
      })
      .from(inventoryAdjustment)
      .innerJoin(variant, eq(variant.id, inventoryAdjustment.variantId))
      .innerJoin(product, eq(product.id, variant.productId))
      .where(
        and(
          eq(inventoryAdjustment.reason, 'returned'),
          gte(inventoryAdjustment.createdAt, span.from),
          lt(inventoryAdjustment.createdAt, span.to),
        ),
      )
    const sold = groupBy(await lineFacts(tx, span), (l) => l.variantId)
    const soldOf = (id: string) => sumOf(sold.get(id) ?? [], (l) => l.quantity)
    const rows = [...groupBy(returned, (r) => r.variantId)].map(([key, group]) => {
      const first = group[0] as (typeof returned)[number]
      const units = sumOf(group, (r) => Math.max(0, r.delta))
      return {
        key,
        values: {
          variant: variantLabel(first.productTitle, first.variantTitle),
          sku: first.sku,
          returned: units,
          sold: soldOf(key),
          returnRate: ratio(units, soldOf(key)),
        },
      }
    })
    const units = sumOf(returned, (r) => Math.max(0, r.delta))
    const soldTotal = sumOf([...sold.values()].flat(), (l) => l.quantity)
    return {
      rows: rows.sort(byDesc('returned')),
      totals: { returned: units, sold: soldTotal, returnRate: ratio(units, soldTotal) },
    }
  },
}
