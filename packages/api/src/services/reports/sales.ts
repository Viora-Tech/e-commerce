import type { StoreTx } from '@commerce/db'
import { discount, discountUsage, order, orderLine, product, variant } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import { bucketByDay } from '../analytics-buckets'
import { type OrderFact, orderFacts, refundFacts, shipmentFacts } from './facts'
import {
  byDesc,
  counted,
  groupBy,
  paymentType,
  placedIn,
  type ReportBuilder,
  type ReportRow,
  type ReportSpan,
  ratio,
  sumOf,
  withShare,
} from './types'

const PINCODE_ROWS = 200

export type LineFact = {
  orderId: string
  productId: string
  productTitle: string
  vendor: string | null
  productType: string | null
  variantId: string
  variantTitle: string
  sku: string | null
  quantity: number
  grossPaise: number
}

/** Order lines of counted orders placed in the span, with product facts. */
export async function lineFacts(tx: StoreTx, span: ReportSpan): Promise<LineFact[]> {
  const rows = await tx
    .select({
      orderId: order.id,
      productId: product.id,
      productTitle: product.title,
      vendor: product.vendor,
      productType: product.productType,
      variantId: variant.id,
      variantTitle: variant.title,
      sku: variant.sku,
      quantity: orderLine.quantity,
      unitPricePaise: orderLine.unitPricePaise,
    })
    .from(orderLine)
    .innerJoin(order, eq(order.id, orderLine.orderId))
    .innerJoin(variant, eq(variant.id, orderLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(and(counted, placedIn(span)))
  return rows.map(({ unitPricePaise, ...r }) => ({ ...r, grossPaise: r.quantity * unitPricePaise }))
}

/** "Mouse / Black" reads better than a bare "Black"; a default variant reads as its product. */
export function variantLabel(productTitle: string, variantTitle: string): string {
  return !variantTitle || variantTitle === 'Default Title' || variantTitle === productTitle
    ? productTitle
    : `${productTitle} / ${variantTitle}`
}

/** Sums lines under a grouping key: orders, units, gross sales and distinct products. */
function lineGroups(
  lines: LineFact[],
  keyOf: (l: LineFact) => string,
  label: (first: LineFact) => Record<string, string | null>,
): ReportRow[] {
  const total = sumOf(lines, (l) => l.grossPaise)
  const rows = [...groupBy(lines, keyOf)].map(([key, group]) => ({
    key,
    values: {
      ...label(group[0] as LineFact),
      orders: new Set(group.map((l) => l.orderId)).size,
      units: sumOf(group, (l) => l.quantity),
      grossSales: sumOf(group, (l) => l.grossPaise),
      products: new Set(group.map((l) => l.productId)).size,
    },
  }))
  return withShare(rows, 'grossSales', total).sort(byDesc('grossSales'))
}

function lineTotals(lines: LineFact[]) {
  return {
    orders: new Set(lines.map((l) => l.orderId)).size,
    units: sumOf(lines, (l) => l.quantity),
    grossSales: sumOf(lines, (l) => l.grossPaise),
    products: new Set(lines.map((l) => l.productId)).size,
    share: lines.length > 0 ? 1 : null,
  }
}

const lineReport =
  (
    keyOf: (l: LineFact) => string,
    label: (first: LineFact) => Record<string, string | null>,
  ): ReportBuilder =>
  async (tx, span) => {
    const lines = await lineFacts(tx, span)
    return { rows: lineGroups(lines, keyOf, label), totals: lineTotals(lines) }
  }

/** Totals shared by the order-level breakdowns. */
function orderTotals(orders: OrderFact[]) {
  const totalSales = sumOf(orders, (o) => o.totalPaise)
  return {
    orders: orders.length,
    totalSales,
    aov: orders.length > 0 ? Math.round(totalSales / orders.length) : null,
    share: orders.length > 0 ? 1 : null,
  }
}

function orderGroups(
  orders: OrderFact[],
  keyOf: (o: OrderFact) => string,
  label: (first: OrderFact) => Record<string, string | null>,
): ReportRow[] {
  const total = sumOf(orders, (o) => o.totalPaise)
  const rows = [...groupBy(orders, keyOf)].map(([key, group]) => ({
    key,
    values: {
      ...label(group[0] as OrderFact),
      ...orderTotals(group),
      codShare: ratio(group.filter((o) => o.paymentMethod === 'cod').length, group.length),
    },
  }))
  return withShare(rows, 'totalSales', total).sort(byDesc('totalSales'))
}

const live = (orders: OrderFact[]) => orders.filter((o) => !o.cancelled)

export const salesBuilders: Record<string, ReportBuilder> = {
  'sales-over-time': async (tx, span) => {
    const orders = live(await orderFacts(tx, span))
    const refunds = await refundFacts(tx, span)
    const day = (pick: (o: OrderFact) => number) =>
      bucketByDay(
        orders.map((o) => ({ at: o.placedAt, weight: pick(o) })),
        span.days,
      )
    const orderCount = day(() => 1)
    const gross = day((o) => o.subtotalPaise)
    const discounts = day((o) => o.discountPaise)
    const shipping = day((o) => o.shippingPaise)
    const fees = day((o) => o.adjustmentPaise)
    const taxes = day((o) => o.taxPaise)
    const returns = bucketByDay(
      refunds.map((r) => ({ at: r.at, weight: r.amountPaise })),
      span.days,
    )
    const rows = span.days.map((d, i) => {
      const netSales = (gross[i] ?? 0) - (discounts[i] ?? 0) - (returns[i] ?? 0)
      return {
        key: d,
        values: {
          day: d,
          orders: orderCount[i] ?? 0,
          grossSales: gross[i] ?? 0,
          discounts: discounts[i] ?? 0,
          returns: returns[i] ?? 0,
          netSales,
          shipping: shipping[i] ?? 0,
          paymentFees: fees[i] ?? 0,
          taxes: taxes[i] ?? 0,
          totalSales: netSales + (shipping[i] ?? 0) + (fees[i] ?? 0),
        },
      }
    })
    const totals: Record<string, number> = {}
    for (const r of rows) {
      for (const [k, v] of Object.entries(r.values)) {
        if (typeof v === 'number') totals[k] = (totals[k] ?? 0) + v
      }
    }
    return { rows, totals }
  },

  'sales-by-product': lineReport(
    (l) => l.productId,
    (l) => ({ product: l.productTitle, vendor: l.vendor }),
  ),
  'sales-by-variant': lineReport(
    (l) => l.variantId,
    (l) => ({ variant: variantLabel(l.productTitle, l.variantTitle), sku: l.sku }),
  ),
  'sales-by-vendor': lineReport(
    (l) => l.vendor?.trim() || '',
    (l) => ({ vendor: l.vendor?.trim() || null }),
  ),
  'sales-by-product-type': lineReport(
    (l) => l.productType?.trim() || '',
    (l) => ({ productType: l.productType?.trim() || null }),
  ),

  'sales-by-state': async (tx, span) => {
    const orders = live(await orderFacts(tx, span))
    return {
      rows: orderGroups(
        orders,
        (o) => o.stateCode ?? '',
        (o) => ({ state: o.stateCode }),
      ),
      totals: {
        ...orderTotals(orders),
        codShare: ratio(orders.filter((o) => o.paymentMethod === 'cod').length, orders.length),
      },
    }
  },

  'sales-by-pincode': async (tx, span) => {
    const orders = live(await orderFacts(tx, span)).filter((o) => o.pincode)
    return {
      rows: orderGroups(
        orders,
        (o) => o.pincode ?? '',
        (o) => ({ pincode: o.pincode, city: o.city, state: o.stateCode }),
      ).slice(0, PINCODE_ROWS),
      totals: orderTotals(orders),
    }
  },

  'sales-by-payment-method': async (tx, span) => {
    const orders = live(await orderFacts(tx, span))
    return {
      rows: orderGroups(
        orders,
        (o) => o.paymentMethod ?? '',
        (o) => ({ method: o.paymentMethod, paymentType: paymentType(o.paymentMethod) }),
      ),
      totals: orderTotals(orders),
    }
  },

  'cod-vs-prepaid': async (tx, span) => {
    const all = await orderFacts(tx, span)
    const orders = live(all)
    const shipments = await shipmentFacts(tx, span)
    const rows = orderGroups(
      orders,
      (o) => paymentType(o.paymentMethod),
      (o) => ({ paymentType: paymentType(o.paymentMethod) }),
    ).map((r) => {
      const mine = shipments.filter((s) => paymentType(s.paymentMethod) === r.key)
      const rto = mine.filter((s) => s.status === 'rto').length
      const closed = rto + mine.filter((s) => s.status === 'delivered').length
      return {
        ...r,
        values: {
          ...r.values,
          cancelled: all.filter((o) => o.cancelled && paymentType(o.paymentMethod) === r.key)
            .length,
          rtoRate: ratio(rto, closed),
        },
      }
    })
    const rto = shipments.filter((s) => s.status === 'rto').length
    return {
      rows: rows.sort(byDesc('orders')),
      totals: {
        ...orderTotals(orders),
        cancelled: all.filter((o) => o.cancelled).length,
        rtoRate: ratio(rto, rto + shipments.filter((s) => s.status === 'delivered').length),
      },
    }
  },

  'discount-performance': async (tx, span) => {
    const rows = await tx
      .select({
        discountId: discountUsage.discountId,
        title: discount.title,
        code: discount.code,
        amountPaise: discountUsage.amountPaise,
        totalPaise: order.totalPaise,
      })
      .from(discountUsage)
      .innerJoin(discount, eq(discount.id, discountUsage.discountId))
      .innerJoin(order, eq(order.id, discountUsage.orderId))
      .where(and(counted, placedIn(span)))
    const grouped = [...groupBy(rows, (r) => r.discountId)].map(([key, group]) => {
      const first = group[0] as (typeof rows)[number]
      const totalSales = sumOf(group, (r) => r.totalPaise)
      return {
        key,
        values: {
          discount: first.title,
          code: first.code,
          orders: group.length,
          discounts: sumOf(group, (r) => r.amountPaise),
          totalSales,
          aov: Math.round(totalSales / group.length),
        },
      }
    })
    const totalSales = sumOf(rows, (r) => r.totalPaise)
    return {
      rows: grouped.sort(byDesc('totalSales')),
      totals: {
        orders: rows.length,
        discounts: sumOf(rows, (r) => r.amountPaise),
        totalSales,
        aov: rows.length > 0 ? Math.round(totalSales / rows.length) : null,
      },
    }
  },
}
