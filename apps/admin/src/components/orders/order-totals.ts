import { orderDetailContent as copy } from '@/data/orders'
import { formatPaise } from '@/lib/money'
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

function taxRows(order: OrderDetail): TotalRow[] {
  const tax = order.taxBreakdown as TaxBreakdown | null
  if (!tax || tax.taxPaise <= 0) return []
  /* Prices already include GST, so these lines explain the total rather than add to it. */
  if (tax.interState) {
    return [
      { label: copy.items.igst(tax.ratePercent), value: formatPaise(tax.igstPaise), muted: true },
    ]
  }
  return [
    { label: copy.items.cgst(tax.ratePercent), value: formatPaise(tax.cgstPaise), muted: true },
    { label: copy.items.sgst(tax.ratePercent), value: formatPaise(tax.sgstPaise), muted: true },
  ]
}

/** Every money line under the items, in the order a merchant reads them. */
export function totalRows(order: OrderDetail): TotalRow[] {
  const rows: TotalRow[] = [{ label: copy.items.subtotal, value: formatPaise(order.subtotalPaise) }]

  if (order.discountPaise > 0) {
    const code = order.discountCode ? ` (${order.discountCode})` : ''
    rows.push({
      label: `${order.discountLabel ?? copy.items.orderDiscount}${code}`,
      value: `−${formatPaise(order.discountPaise)}`,
    })
  }

  rows.push({
    label: order.shippingRateName
      ? `${copy.items.shipping} (${order.shippingRateName})`
      : copy.items.shipping,
    value: formatPaise(order.shippingPaise),
  })

  const adj = order.paymentAdjustmentPaise
  if (adj !== 0) {
    rows.push({
      label: order.paymentAdjustmentLabel ?? (adj < 0 ? copy.items.discount : copy.items.fee),
      value: `${adj < 0 ? '−' : '+'}${formatPaise(Math.abs(adj))}`,
    })
  }

  rows.push(...taxRows(order))
  rows.push({ label: copy.items.total, value: formatPaise(order.totalPaise), strong: true })

  const balance = order.balance
  rows.push({
    label: copy.items.paidByCustomer,
    value: formatPaise(balance.capturedPaise),
    settlement: true,
  })
  if (balance.refundedPaise > 0) {
    rows.push({
      label: copy.items.refunded,
      value: `−${formatPaise(balance.refundedPaise)}`,
      muted: true,
      settlement: true,
    })
  }
  if (balance.balancePaise !== 0) {
    rows.push({
      label: balance.balancePaise > 0 ? copy.items.balanceOwed : copy.items.balance,
      value: formatPaise(Math.abs(balance.balancePaise)),
      strong: true,
      settlement: true,
    })
  }

  return rows
}
