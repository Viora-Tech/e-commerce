import type { OrderEditInput } from '@commerce/core'
import type { api } from '@/lib/api-client'
import type { OrderDetail, OrderLine } from '../order-detail-types'

export type VariantResult = Awaited<ReturnType<typeof api.products.searchVariants>>[number]

/** An item the edit adds, keyed by variant (adding the same one again raises its quantity). */
export type AddedLine = {
  variantId: string
  title: string
  variantTitle: string
  sku: string | null
  imageUrl: string | null
  quantity: number
  unitPricePaise: number
}

export type EditState = {
  /** New quantity per existing line id; absent keeps it. 0 removes the line. */
  quantities: Record<string, number>
  /** New unit price per existing line id; absent keeps it. */
  prices: Record<string, number>
  added: AddedLine[]
  shippingPaise: number
  discountPaise: number
  /** What the shipping is ("Bluedart") and what the discount is for ("UPI discount"). */
  shippingLabel: string
  discountLabel: string
}

export const startState = (order: OrderDetail): EditState => ({
  quantities: {},
  prices: {},
  added: [],
  shippingPaise: order.shippingPaise,
  discountPaise: order.discountPaise,
  shippingLabel: order.shippingRateName ?? '',
  discountLabel: order.discountLabel ?? '',
})

export const quantityOf = (state: EditState, line: OrderLine): number =>
  state.quantities[line.id] ?? line.quantity

export const priceOf = (state: EditState, line: OrderLine): number =>
  state.prices[line.id] ?? line.unitPricePaise

const lineChanged = (state: EditState, l: OrderLine) =>
  quantityOf(state, l) !== l.quantity || priceOf(state, l) !== l.unitPricePaise

const labelChanged = (typed: string, saved: string | null) => typed.trim() !== (saved ?? '')

const isDefault = (variantTitle: string | null) =>
  !variantTitle || variantTitle === 'Default' || variantTitle === 'Default Title'

/** "Mousepad / Black", or just the title for a product with one variant. */
export const lineName = (title: string | null, variantTitle: string | null) =>
  isDefault(variantTitle) ? (title ?? '') : `${title ?? ''} / ${variantTitle}`

/** What the server's preview and save take (`OrderEditSchema`). */
export function editInput(order: OrderDetail, state: EditState): OrderEditInput {
  return {
    orderId: order.id,
    lines: order.lines
      .filter((l) => lineChanged(state, l))
      .map((l) => ({
        lineId: l.id,
        quantity: quantityOf(state, l),
        unitPricePaise: priceOf(state, l),
      })),
    add: state.added.map((a) => ({
      variantId: a.variantId,
      quantity: a.quantity,
      unitPricePaise: a.unitPricePaise,
    })),
    shippingPaise: state.shippingPaise,
    discountPaise: state.discountPaise,
    shippingLabel: state.shippingLabel.trim(),
    discountLabel: state.discountLabel.trim(),
  }
}

/** True once anything differs from the order as placed. */
export const isDirty = (order: OrderDetail, state: EditState): boolean =>
  state.added.length > 0 ||
  order.lines.some((l) => lineChanged(state, l)) ||
  state.shippingPaise !== order.shippingPaise ||
  state.discountPaise !== order.discountPaise ||
  labelChanged(state.shippingLabel, order.shippingRateName) ||
  labelChanged(state.discountLabel, order.discountLabel)

/**
 * The running summary beside the editor, moved by the difference like the server does
 * (`planOrderEdit`), so an imported order's recorded totals keep what the lines do not show.
 */
export function localTotals(order: OrderDetail, state: EditState) {
  const lineDelta =
    order.lines.reduce(
      (sum, l) => sum + quantityOf(state, l) * priceOf(state, l) - l.quantity * l.unitPricePaise,
      0,
    ) + state.added.reduce((sum, a) => sum + a.quantity * a.unitPricePaise, 0)
  const subtotalPaise = Math.max(0, order.subtotalPaise + lineDelta)
  const discountPaise = Math.min(state.discountPaise, subtotalPaise)
  const totalPaise = Math.max(
    0,
    order.totalPaise +
      (subtotalPaise - order.subtotalPaise) -
      (discountPaise - order.discountPaise) +
      (state.shippingPaise - order.shippingPaise),
  )
  return { subtotalPaise, discountPaise, shippingPaise: state.shippingPaise, totalPaise }
}
