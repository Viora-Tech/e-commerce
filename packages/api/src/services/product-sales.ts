// Pure maths for the product page's "Sales past 90 days" card (#56); the query is in
// product-sales.service.ts.

/** One order line of the product, with what its order carried. */
export type ProductSaleLine = {
  orderId: string
  /** Who bought: the customer, else the lower-cased email, else the order itself. */
  buyerKey: string
  quantity: number
  unitPricePaise: number
  /** The whole order's goods value before discount. */
  orderSubtotalPaise: number
  orderDiscountPaise: number
}

export type ProductSales = {
  units: number
  orders: number
  buyers: number
  /** Line value at the price paid, before discounts. */
  grossPaise: number
  /** Gross less this product's share of each order's discount and refunds. */
  netPaise: number
}

/**
 * Sums the product's lines. An order's discount and refunds are shared over its goods by value
 * (the product's lines against the order subtotal), so a product in a mixed cart carries only
 * its part; a share never takes a line below zero.
 */
export function summariseProductSales(
  lines: readonly ProductSaleLine[],
  refundedByOrder: ReadonlyMap<string, number>,
): ProductSales {
  const byOrder = new Map<string, ProductSaleLine[]>()
  for (const line of lines) {
    const list = byOrder.get(line.orderId) ?? []
    list.push(line)
    byOrder.set(line.orderId, list)
  }
  let units = 0
  let grossPaise = 0
  let netPaise = 0
  for (const [orderId, orderLines] of byOrder) {
    const first = orderLines[0]
    if (!first) continue
    const gross = orderLines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)
    units += orderLines.reduce((sum, l) => sum + l.quantity, 0)
    grossPaise += gross
    const subtotal = Math.max(first.orderSubtotalPaise, gross)
    const part = (amount: number) =>
      subtotal > 0 ? Math.round((Math.max(0, amount) * gross) / subtotal) : 0
    const discount = Math.min(gross, part(first.orderDiscountPaise))
    const refund = Math.min(gross - discount, part(refundedByOrder.get(orderId) ?? 0))
    netPaise += gross - discount - refund
  }
  return {
    units,
    orders: byOrder.size,
    buyers: new Set(lines.map((l) => l.buyerKey)).size,
    grossPaise,
    netPaise,
  }
}
