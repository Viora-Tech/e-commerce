import { gstRowsToShow } from '@commerce/core/gst'
import type { orderDetailContent } from '@/data/order-detail'
import type { Formatters } from '@/lib/format'
import type { OrderDetail } from './order-detail-types'

export type TotalRow = {
  label: string
  value: string
  strong?: boolean
  muted?: boolean
}

type TaxBreakdown = {
  taxPaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  ratePercent: number
  interState: boolean
}

/** "Haryana · 06AAPFU0939F1ZV": the GST number the order is billed from, when it had one. */
function billedFrom(order: OrderDetail, copy: typeof orderDetailContent): TotalRow[] {
  const origin = order.taxOrigin
  if (!origin?.gstin) return []
  const place = origin.stateName ?? origin.stateCode
  return [
    {
      label: copy.items.billedFrom,
      value: place ? `${place} · ${origin.gstin}` : origin.gstin,
      muted: true,
    },
  ]
}

function taxRows(order: OrderDetail, copy: typeof orderDetailContent, fmt: Formatters): TotalRow[] {
  const tax = order.taxBreakdown as TaxBreakdown | null
  if (!tax || tax.taxPaise <= 0) return []
  /* Prices already include GST, so these lines explain the total rather than add to it. Parcels
     from different states put both CGST + SGST and IGST on one order. */
  const show = gstRowsToShow(tax)
  return [
    ...(show.intraState
      ? [
          { label: copy.items.cgst(tax.ratePercent), value: fmt.money(tax.cgstPaise), muted: true },
          { label: copy.items.sgst(tax.ratePercent), value: fmt.money(tax.sgstPaise), muted: true },
        ]
      : []),
    ...(show.interState
      ? [{ label: copy.items.igst(tax.ratePercent), value: fmt.money(tax.igstPaise), muted: true }]
      : []),
    ...billedFrom(order, copy),
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
    // The rate's own name ("Bluedart") when it has one, like the discount's label above.
    label: order.shippingRateName || copy.items.shipping,
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
  })
  if (balance.refundedPaise > 0) {
    rows.push({
      label: copy.items.refunded,
      value: `−${fmt.money(balance.refundedPaise)}`,
      muted: true,
    })
  }
  if (balance.balancePaise !== 0) {
    rows.push({
      label: balance.balancePaise > 0 ? copy.items.balanceOwed : copy.items.balance,
      value: fmt.money(Math.abs(balance.balancePaise)),
      strong: true,
    })
  }

  return rows
}
