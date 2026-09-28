import type { orderDetailContent } from '@/data/orders'
import type { Formatters } from '@/lib/format'
import type { OrderDetail } from './order-detail-types'

export type TotalRow = {
  label: string
  value: string
  strong?: boolean
  muted?: boolean
  /** Sits under the total, separated by a rule: what was paid and what is left. */
  settlement?: boolean
}

type TaxBreakdown = {
  taxPaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  ratePercent: number
  interState: boolean
}

function taxRows(order: OrderDetail, copy: typeof orderDetailContent, fmt: Formatters): TotalRow[] {
  const tax = order.taxBreakdown as TaxBreakdown | null
  if (!tax || tax.taxPaise <= 0) return []
  /* Prices already include GST, so these lines explain the total rather than add to it. */
  if (tax.interState) {
    return [
      { label: copy.items.igst(tax.ratePercent), value: fmt.money(tax.igstPaise), muted: true },
    ]
  }
  return [
    { label: copy.items.cgst(tax.ratePercent), value: fmt.money(tax.cgstPaise), muted: true },
    { label: copy.items.sgst(tax.ratePercent), value: fmt.money(tax.sgstPaise), muted: true },
  ]
}

/** Every money line under the items, in the order a merchant reads them. */
export function totalRows(
  order: OrderDetail,
  copy: typeof orderDetailContent,
  fmt: Formatters,
): TotalRow[] {
  const rows: TotalRow[] = [{ label: copy.items.subtotal, value: fmt.money(order.subtotalPaise) }]

  if (order.discountPaise > 0) {
    const code = order.discountCode ? ` (${order.discountCode})` : ''
    rows.push({
      label: `${order.discountLabel ?? copy.items.orderDiscount}${code}`,
      value: `−${fmt.money(order.discountPaise)}`,
    })
  }

  rows.push({
    label: order.shippingRateName
      ? `${copy.items.shipping} (${order.shippingRateName})`
      : copy.items.shipping,
    value: fmt.money(order.shippingPaise),
  })

  const adj = order.paymentAdjustmentPaise
  if (adj !== 0) {
    rows.push({
      label: order.paymentAdjustmentLabel ?? (adj < 0 ? copy.items.discount : copy.items.fee),
      value: `${adj < 0 ? '−' : '+'}${fmt.money(Math.abs(adj))}`,
    })
  }

  rows.push(...taxRows(order, copy, fmt))
  rows.push({ label: copy.items.total, value: fmt.money(order.totalPaise), strong: true })

  const balance = order.balance
  rows.push({
    label: copy.items.paidByCustomer,
    value: fmt.money(balance.capturedPaise),
    settlement: true,
  })
  if (balance.refundedPaise > 0) {
    rows.push({
      label: copy.items.refunded,
      value: `−${fmt.money(balance.refundedPaise)}`,
      muted: true,
      settlement: true,
    })
  }
  if (balance.balancePaise !== 0) {
    rows.push({
      label: balance.balancePaise > 0 ? copy.items.balanceOwed : copy.items.balance,
      value: fmt.money(Math.abs(balance.balancePaise)),
      strong: true,
      settlement: true,
    })
  }

  return rows
}
