import type { StoreTx } from '@commerce/db'
import { order, orderLine, refund, variant } from '@commerce/db'
import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { type ProductSales, summariseProductSales } from './product-sales'
import { counted } from './reports/types'

/** The window the product page's sales card covers. */
const PRODUCT_SALES_DAYS = 90

export type ProductSalesCard = ProductSales & { days: number; from: Date }

/**
 * "Sales past 90 days" on the product page (#56): units, buyers and net revenue of the
 * product's variants, by the reports' rules: drafts, test-mode and cancelled orders never count
 * (`counted`), and refunds are the processed or manual ones, as in the sales reports.
 */
export async function productSales(
  tx: StoreTx,
  productId: string,
  now: Date = new Date(),
): Promise<ProductSalesCard> {
  const from = new Date(now.getTime() - PRODUCT_SALES_DAYS * 86_400_000)
  const lines = await tx
    .select({
      orderId: order.id,
      buyerKey: sql<string>`coalesce(${order.customerId}::text, lower(${order.email}), ${order.id}::text)`,
      quantity: orderLine.quantity,
      unitPricePaise: orderLine.unitPricePaise,
      orderSubtotalPaise: order.subtotalPaise,
      orderDiscountPaise: order.discountPaise,
    })
    .from(orderLine)
    .innerJoin(order, eq(order.id, orderLine.orderId))
    .innerJoin(variant, eq(variant.id, orderLine.variantId))
    .where(
      and(
        eq(variant.productId, productId),
        eq(orderLine.giftCard, false),
        counted,
        gte(order.placedAt, from),
      ),
    )
  const orderIds = [...new Set(lines.map((l) => l.orderId))]
  const refunds = orderIds.length
    ? await tx
        .select({
          orderId: refund.orderId,
          amountPaise: sql<number>`coalesce(sum(${refund.amountPaise}), 0)::int`,
        })
        .from(refund)
        .where(
          and(inArray(refund.orderId, orderIds), inArray(refund.status, ['processed', 'manual'])),
        )
        .groupBy(refund.orderId)
    : []
  const refunded = new Map(refunds.map((r) => [r.orderId, Number(r.amountPaise)]))
  return { ...summariseProductSales(lines, refunded), days: PRODUCT_SALES_DAYS, from }
}
