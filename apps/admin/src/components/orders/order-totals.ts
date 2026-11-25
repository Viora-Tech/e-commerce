import { gstRowsToShow } from '@commerce/core/gst'
import type { orderDetailContent } from '@/data/order-detail'
import type { Formatters } from '@/lib/format'
import type { OrderDetail } from './order-detail-types'

export type TotalRow = {
  label: string
  value: string
  /** Small grey note beside the label: "2 items", the checkout rate's name, the code. */
  detail?: string
  strong?: boolean
  muted?: boolean
  /** A rule above it: the start of what was paid, after the total. */
  rule?: boolean
  /**
   * `sum`: the one "GST (included)" line; `split`: its CGST/SGST or IGST lines and the GST
   * number it is billed from, shown only when the sum is opened (Indian invoices need them).
   */
  tax?: 'sum' | 'split'
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
      tax: 'split',
    },
  ]
}

function taxRows(order: OrderDetail, copy: typeof orderDetailContent, fmt: Formatters): TotalRow[] {
  const tax = order.taxBreakdown as TaxBreakdown | null
  if (!tax || tax.taxPaise <= 0) return []
  /* Prices already include GST, so these lines explain the total rather than add to it. Parcels
     from different states put both CGST + SGST and IGST on one order. */
  const show = gstRowsToShow(tax)
  const split = (label: string, paise: number): TotalRow => ({
    label,
    value: fmt.money(paise),
    muted: true,
    tax: 'split',
  })
  return [
    { label: copy.items.gstIncluded, value: fmt.money(tax.taxPaise), tax: 'sum' },
    ...(show.intraState
      ? [
          split(copy.items.cgst(tax.ratePercent), tax.cgstPaise),
          split(copy.items.sgst(tax.ratePercent), tax.sgstPaise),
        ]
      : []),
    ...(show.interState ? [split(copy.items.igst(tax.ratePercent), tax.igstPaise)] : []),
    ...billedFrom(order, copy),
  ]
}

/** Every money line under the items, in the order a merchant reads them. */
export function totalRows(
  order: OrderDetail,
  copy: typeof orderDetailContent,
  fmt: Formatters,
): TotalRow[] {
  const units = order.lines.reduce((n, l) => n + l.quantity, 0)
  const rows: TotalRow[] = [
    {
      label: copy.items.subtotal,
      value: fmt.money(order.subtotalPaise),
      ...(units > 0 ? { detail: copy.unfulfilled.itemsCount(units) } : {}),
    },
  ]

  if (order.discountPaise > 0) {
    // "Discount · DIWALI10": the code (or the automatic offer's name) is the note.
    const note = order.discountCode ?? order.discountLabel
    rows.push({
      label: copy.items.orderDiscount,
      value: `−${fmt.money(order.discountPaise)}`,
      ...(note ? { detail: note } : {}),
    })
  }

  /* Always "Shipping": the rate the customer picked at checkout ("Standard · Courier X") is only a
     note, since another courier may carry the parcel in the end. */
  const rateName = order.shippingRateName?.trim()
  rows.push({
    label: copy.items.shipping,
    value: fmt.money(order.shippingPaise),
    ...(rateName && rateName !== copy.items.shipping ? { detail: rateName } : {}),
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
    rule: true,
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
