/** SOURCE OF TRUTH: duplicating an order — WHAT: a new draft order prefilled from an existing order (customer, address, lines at today's prices, notes, shipping) / WHY: a repeat or replacement order is built in seconds and still goes through the draft review, never placed directly */
import { address, order, orderLine, orderNote, product, variant } from '@commerce/db'
import { and, asc, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { createDraft, type DraftInput } from './drafts'

/** The draft editor's limits (`DraftLineSchema`, `DraftInputSchema`). */
const MAX_LINES = 100
const MAX_QUANTITY = 999

export type DuplicatedOrder = {
  id: string
  number: number
  /** Lines left out because their product is archived or gone: "Glasspad / Black". */
  skipped: string[]
}

const lineName = (title: string | null, variantTitle: string | null) =>
  variantTitle && variantTitle !== 'Default' ? `${title ?? ''} / ${variantTitle}` : (title ?? '')

/**
 * A new draft from an order: the same customer, contact and shipping address, the same lines
 * at the catalogue's price today, the shipping charge and rate, the shopper's note and the
 * draft note. Lines whose product is archived (or no longer exists) are skipped and named in
 * the result and in the draft's note. No discount is carried over: a code is re-entered on
 * the draft, where checkout's rules check it again. Null when the order is not in the store.
 */
export async function duplicateOrderAsDraft(
  ctx: StoreContext,
  orderId: string,
): Promise<DuplicatedOrder | null> {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId))
  if (!o) return null
  const [rows, notes, ship, bill] = await Promise.all([
    ctx.tx
      .select({
        variantId: orderLine.variantId,
        title: orderLine.title,
        variantTitle: orderLine.variantTitle,
        quantity: orderLine.quantity,
        liveVariant: variant.id,
        productStatus: product.status,
      })
      .from(orderLine)
      .leftJoin(variant, eq(variant.id, orderLine.variantId))
      .leftJoin(product, eq(product.id, variant.productId))
      .where(eq(orderLine.orderId, orderId))
      .orderBy(asc(orderLine.id)),
    ctx.tx
      .select({ body: orderNote.body })
      .from(orderNote)
      .where(and(eq(orderNote.orderId, orderId), eq(orderNote.author, 'draft'))),
    o.shippingAddressId
      ? ctx.tx.select().from(address).where(eq(address.id, o.shippingAddressId))
      : Promise.resolve([]),
    o.billingAddressId
      ? ctx.tx.select().from(address).where(eq(address.id, o.billingAddressId))
      : Promise.resolve([]),
  ])

  const available = rows.filter((r) => r.liveVariant && r.productStatus !== 'archived')
  const skipped = rows
    .filter((r) => !available.includes(r))
    .map((r) => lineName(r.title, r.variantTitle))
  // One line per variant, as the draft editor keeps them.
  const quantities = new Map<string, number>()
  for (const r of available) {
    quantities.set(
      r.variantId,
      Math.min((quantities.get(r.variantId) ?? 0) + r.quantity, MAX_QUANTITY),
    )
  }
  const lines = [...quantities].slice(0, MAX_LINES).map(([variantId, quantity]) => ({
    variantId,
    quantity,
  }))

  const a = ship[0]
  const note = [
    `Duplicated from order #${o.number}.`,
    skipped.length > 0 ? `Not copied (no longer available): ${skipped.join(', ')}.` : null,
    notes[0]?.body ?? null,
  ]
    .filter(Boolean)
    .join('\n')
  const input: DraftInput = {
    customerId: o.customerId,
    email: o.email,
    // The order's contact phone, else the one on its shipping address (orders placed with the phone
    // only on the address, or by an admin before contact phones were kept, have none of their own).
    phone: o.phone || ship[0]?.phone || null,
    shipping: a
      ? {
          name: a.name,
          line1: a.line1,
          line2: a.line2 ?? undefined,
          city: a.city,
          stateCode: a.stateCode,
          pincode: a.pincode,
          phone: a.phone,
        }
      : null,
    // A separate billing address goes along; the GSTIN and company are copied below.
    billing: bill[0]
      ? {
          name: bill[0].name,
          line1: bill[0].line1,
          line2: bill[0].line2 ?? undefined,
          city: bill[0].city,
          stateCode: bill[0].stateCode,
          pincode: bill[0].pincode,
          phone: bill[0].phone,
        }
      : null,
    lines,
    discountPaise: 0,
    shippingPaise: o.shippingPaise,
    paymentMethod: o.paymentMethod === 'cod' ? 'cod' : null,
    note,
  }
  const created = await createDraft(ctx, input)
  await ctx.tx
    .update(order)
    .set({
      shippingRateId: o.shippingRateId,
      shippingRateName: o.shippingRateName,
      customerNote: o.customerNote,
      buyerGstin: o.buyerGstin,
      buyerBusinessName: o.buyerBusinessName,
    })
    .where(eq(order.id, created.id))
  return { ...created, skipped }
}
