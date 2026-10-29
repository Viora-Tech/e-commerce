/** SOURCE OF TRUTH: OrderEditSchema, planOrderEdit — WHAT: the arithmetic of an order edit (new lines, totals, what the customer owes or is owed) with no database / WHY: the review step and the save must agree to the paisa, so both run this */
import { z } from 'zod'
import { CommerceError } from '../errors'

/** Most lines one edit adds; an order page is not a bulk import. */
const EDIT_ADD_MAX = 50
const QTY_MAX = 9999
const LABEL_MAX = 120

export const OrderEditSchema = z.object({
  orderId: z.uuid(),
  /**
   * New quantities for lines already on the order (0 removes the line), and optionally a new
   * unit price; an omitted price keeps the line's.
   */
  lines: z
    .array(
      z.object({
        lineId: z.uuid(),
        quantity: z.number().int().min(0).max(QTY_MAX),
        unitPricePaise: z.number().int().min(0).max(1_000_000_000).optional(),
      }),
    )
    .max(200)
    .default([]),
  /** Items to add, at the catalogue price unless the merchant sets one. */
  add: z
    .array(
      z.object({
        variantId: z.uuid(),
        quantity: z.number().int().min(1).max(QTY_MAX),
        unitPricePaise: z.number().int().min(0).max(1_000_000_000).optional(),
      }),
    )
    .max(EDIT_ADD_MAX)
    .default([]),
  /** The new shipping charge; omitted keeps it. */
  shippingPaise: z.number().int().min(0).max(100_000_000).optional(),
  /** The new order discount; omitted keeps it. Never more than the subtotal. */
  discountPaise: z.number().int().min(0).max(1_000_000_000).optional(),
  /** What the discount is for ("UPI discount"); omitted keeps it, empty clears it. */
  discountLabel: z.string().trim().max(LABEL_MAX).nullish(),
  /** What the shipping is ("Bluedart"); omitted keeps it, empty clears it. */
  shippingLabel: z.string().trim().max(LABEL_MAX).nullish(),
})
export type OrderEditInput = z.input<typeof OrderEditSchema>
export type OrderEdit = z.output<typeof OrderEditSchema>

export class OrderEditRefused extends CommerceError {
  readonly reason:
    | 'not_editable'
    | 'fulfilled_line'
    | 'gift_card'
    | 'unknown_line'
    | 'unknown_variant'
    | 'empty'
    | 'no_change'
    | 'awaiting_payment'
    | 'returned_line'
  constructor(reason: OrderEditRefused['reason'], message: string, storeId?: string) {
    super('ORDER_EDIT_REFUSED', message, { storeId })
    this.reason = reason
  }
}

export type EditCurrentLine = {
  id: string
  variantId: string
  title: string | null
  variantTitle: string | null
  quantity: number
  fulfilledQuantity: number
  unitPricePaise: number
  giftCard: boolean
}

export type EditVariant = {
  id: string
  title: string
  variantTitle: string
  pricePaise: number
  giftCard: boolean
}

export type EditTotals = {
  subtotalPaise: number
  discountPaise: number
  shippingPaise: number
  /** The payment-method fee or discount, kept as charged at checkout. */
  adjustmentPaise: number
  totalPaise: number
}

/** The words beside the discount and shipping (`order.discount_label`, `order.shipping_rate_name`). */
export type EditLabels = {
  discountLabel: string | null
  shippingLabel: string | null
}

export type EditLineChange = 'same' | 'changed' | 'removed' | 'added'

export type PlannedLine = {
  /** Null for an added line (it gets its id on save). */
  lineId: string | null
  variantId: string
  title: string | null
  variantTitle: string | null
  unitPricePaise: number
  unitPriceBefore: number
  quantityBefore: number
  quantity: number
  fulfilledQuantity: number
  change: EditLineChange
}

export type EditPlan = {
  lines: PlannedLine[]
  before: EditTotals
  after: EditTotals
  /**
   * The new total less the money the order keeps (captured, minus refunds). Positive: the
   * customer owes it. Negative: the store owes it back. Zero on an unpaid order means nothing
   * was paid yet; `paidPaise` says how much was.
   */
  differencePaise: number
  paidPaise: number
  labels: { before: EditLabels; after: EditLabels }
}

const sumLines = (lines: readonly { quantity: number; unitPricePaise: number }[]) =>
  lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)

/** A label as typed: undefined keeps the old one, blank clears it. */
const nextLabel = (typed: string | null | undefined, before: string | null): string | null =>
  typed === undefined ? before : typed?.trim() || null

/**
 * The order as it would be after the edit. Refuses a line taken below what was already packed,
 * a gift card line changed (vouchers are issued on payment), a line or variant that is not this
 * order's, an edit that changes nothing, and an order left with no items. A line's unit price can
 * change too (issues 917, 918); the subtotal moves by the difference like any other change.
 */
export function planOrderEdit(input: {
  edit: OrderEdit
  current: readonly EditCurrentLine[]
  variants: readonly EditVariant[]
  before: EditTotals
  paidPaise: number
  labels?: EditLabels
}): EditPlan {
  const { edit, current } = input
  const changes = new Map(edit.lines.map((l) => [l.lineId, l]))
  for (const id of changes.keys()) {
    if (!current.some((l) => l.id === id)) {
      throw new OrderEditRefused('unknown_line', `Line ${id} is not on this order`)
    }
  }
  const lines: PlannedLine[] = current.map((l) => {
    const asked = changes.get(l.id)
    const next = asked?.quantity ?? l.quantity
    const price = asked?.unitPricePaise ?? l.unitPricePaise
    if ((next !== l.quantity || price !== l.unitPricePaise) && l.giftCard) {
      throw new OrderEditRefused('gift_card', 'Gift card lines cannot be changed')
    }
    if (next < l.fulfilledQuantity) {
      throw new OrderEditRefused(
        'fulfilled_line',
        `${l.title ?? 'This item'}: ${l.fulfilledQuantity} already packed, so it cannot go below that`,
      )
    }
    return {
      lineId: l.id,
      variantId: l.variantId,
      title: l.title,
      variantTitle: l.variantTitle,
      unitPricePaise: next === 0 ? l.unitPricePaise : price,
      unitPriceBefore: l.unitPricePaise,
      quantityBefore: l.quantity,
      quantity: next,
      fulfilledQuantity: l.fulfilledQuantity,
      change:
        next === 0
          ? 'removed'
          : next === l.quantity && price === l.unitPricePaise
            ? 'same'
            : 'changed',
    }
  })
  for (const a of edit.add) {
    const v = input.variants.find((x) => x.id === a.variantId)
    if (!v)
      throw new OrderEditRefused('unknown_variant', `Variant ${a.variantId} is not for sale here`)
    if (v.giftCard)
      throw new OrderEditRefused('gift_card', 'Gift cards cannot be added to an order')
    lines.push({
      lineId: null,
      variantId: v.id,
      title: v.title,
      variantTitle: v.variantTitle,
      unitPricePaise: a.unitPricePaise ?? v.pricePaise,
      unitPriceBefore: a.unitPricePaise ?? v.pricePaise,
      quantityBefore: 0,
      quantity: a.quantity,
      fulfilledQuantity: 0,
      change: 'added',
    })
  }
  const kept = lines.filter((l) => l.quantity > 0)
  if (kept.length === 0) {
    throw new OrderEditRefused('empty', 'An order needs at least one item; cancel it instead')
  }
  /* Moved by the difference, not rebuilt from the lines: an imported order's recorded totals
     can carry parts the lines do not (tax added on top, rounding), and those stay as they were. */
  const { before } = input
  const subtotalPaise = Math.max(0, before.subtotalPaise + sumLines(kept) - sumLines(current))
  const shippingPaise = edit.shippingPaise ?? before.shippingPaise
  const discountPaise = Math.min(edit.discountPaise ?? before.discountPaise, subtotalPaise)
  const after: EditTotals = {
    subtotalPaise,
    discountPaise,
    shippingPaise,
    adjustmentPaise: before.adjustmentPaise,
    totalPaise: Math.max(
      0,
      before.totalPaise +
        (subtotalPaise - before.subtotalPaise) -
        (discountPaise - before.discountPaise) +
        (shippingPaise - before.shippingPaise),
    ),
  }
  const labelsBefore = input.labels ?? { discountLabel: null, shippingLabel: null }
  const labelsAfter: EditLabels = {
    discountLabel: nextLabel(edit.discountLabel, labelsBefore.discountLabel),
    shippingLabel: nextLabel(edit.shippingLabel, labelsBefore.shippingLabel),
  }
  const changed =
    lines.some((l) => l.change !== 'same') ||
    after.shippingPaise !== input.before.shippingPaise ||
    after.discountPaise !== input.before.discountPaise ||
    labelsAfter.discountLabel !== labelsBefore.discountLabel ||
    labelsAfter.shippingLabel !== labelsBefore.shippingLabel
  if (!changed) throw new OrderEditRefused('no_change', 'Nothing was changed')
  return {
    lines,
    before: input.before,
    after,
    differencePaise: after.totalPaise - input.paidPaise,
    paidPaise: input.paidPaise,
    labels: { before: labelsBefore, after: labelsAfter },
  }
}
