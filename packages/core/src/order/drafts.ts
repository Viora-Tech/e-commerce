import {
  address,
  notification,
  order,
  orderLine,
  orderNote,
  payment,
  product,
  store,
  variant,
} from '@commerce/db'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { effectiveGstRatePercent, effectiveHsCode } from '../catalog/effective-tax'
import type { StoreContext } from '../context'
import { recordDiscountUse } from '../discounts/usage'
import { CommerceError, PriceNotSet } from '../errors'
import { announceExchangeOrder } from '../returns/notify'
import { StoreAddressSchema } from '../settings/general'
import { assertCustomerInStore } from '../store-scope'
import { chargedGstRate, parseStoreTax } from '../tax/settings'
import { CustomItemSchema, ensureCustomItemVariant } from './custom-item'
import { DraftAddressSchema, DraftBillingSchema, writeAddress, writeBilling } from './draft-billing'
import { draftMoney } from './draft-discount'
import { draftPlaceholder, isDraftPlaceholder } from './draft-ref'
import { releaseDraftHold, reserveDraft } from './draft-reserve'
import { createFulfillmentOrders } from './fulfillment-orders'
import { takeDraftNumber, takeOrderNumber } from './order-number'
import { taxParcels } from './parcel-tax'
import { PaymentTermsSchema, paymentDueAt } from './payment-terms'
import { recomputeOrderStatuses } from './recompute'
import { releaseReserved, routeAndReserve } from './routing-service'

/**
 * Draft orders: an order a merchant builds by hand (phone order, WhatsApp
 * sale, a quote) that has not been placed. It lives in the `order` table with
 * status `draft`, which keeps one order id from creation to fulfilment, and is
 * excluded from every list, stat and revenue figure until it converts. Stock
 * is only reserved at conversion, so a draft never holds inventory hostage.
 */

export class DraftNotEditable extends CommerceError {
  constructor(id: string, storeId?: string) {
    super('DRAFT_NOT_EDITABLE', `Order ${id} is no longer a draft`, { storeId })
  }
}

export class DraftEmpty extends CommerceError {
  constructor(id: string, storeId?: string) {
    super('DRAFT_EMPTY', `Draft ${id} has no lines`, { storeId })
  }
}

/** A draft with something to ship has no address to ship it to. The message is shown as is. */
export class DraftNeedsShippingAddress extends CommerceError {
  constructor(storeId?: string) {
    super('DRAFT_NEEDS_SHIPPING_ADDRESS', 'Add a shipping address before converting', { storeId })
  }
}

export const DraftLineSchema = z
  .object({
    /** The catalogue variant; absent on a custom item. */
    variantId: z.uuid().optional(),
    /** A one-off item not in the catalogue (its own title and price); replaces `variantId`. */
    custom: CustomItemSchema.optional(),
    quantity: z.number().int().min(1).max(999),
    /** Overrides the variant price for this draft only; blank keeps the catalogue price. */
    unitPricePaise: z.number().int().min(0).optional(),
  })
  .refine((l) => (l.custom ? !l.variantId && l.unitPricePaise !== undefined : !!l.variantId), {
    message: 'A line is a catalogue variant, or a custom item with its own price',
  })

export const DraftInputSchema = z.object({
  customerId: z.uuid().nullish(),
  email: z.string().trim().email().max(200).nullish(),
  phone: z.string().trim().max(20).nullish(),
  customerName: z.string().trim().max(120).nullish(),
  shipping: DraftAddressSchema.nullish(),
  /**
   * True: billing is the shipping address ("Billing address is the same as shipping"), and any
   * billing address and GSTIN on the draft are dropped. Otherwise `billing` sets them; with
   * neither, an edit keeps what the draft had.
   */
  billingSameAsShipping: z.boolean().optional(),
  billing: DraftBillingSchema.nullish(),
  lines: z.array(DraftLineSchema).max(100).default([]),
  discountPaise: z.number().int().min(0).default(0),
  discountLabel: z.string().trim().max(120).nullish(),
  /** A store discount code; when set it replaces the manual discount above. */
  discountCode: z.string().trim().max(60).nullish(),
  shippingPaise: z.number().int().min(0).default(0),
  paymentMethod: z.string().trim().max(60).nullish(),
  /** "Payment due later" (#1029): place the order now, collect by these terms. */
  paymentTerms: PaymentTermsSchema.nullish(),
  /** The due date for 'fixed' terms (YYYY-MM-DD). */
  paymentDueDate: z.iso.date().nullish(),
  note: z.string().trim().max(2000).nullish(),
})

export type DraftInput = z.infer<typeof DraftInputSchema>

/** A draft keeps its terms, and a fixed date as its due date until it converts. */
function draftTerms(input: DraftInput) {
  const terms = input.paymentTerms ?? null
  return {
    paymentTerms: terms,
    paymentDueAt:
      terms === 'fixed' && input.paymentDueDate
        ? new Date(`${input.paymentDueDate}T00:00:00Z`)
        : null,
  }
}

export type DraftListItem = {
  id: string
  /** The draft's own number (#D12); null only on a draft older than 0200 that it missed. */
  draftNumber: number | null
  /** The order number a pre-0200 draft reserved; below zero (a placeholder) otherwise. */
  number: number
  customerName: string | null
  email: string | null
  lineCount: number
  totalPaise: number
  createdAt: Date
  invoiceSentAt: Date | null
}

const DRAFT_TAG = 'draft'

/**
 * Line snapshot at the catalogue's current price, or the merchant's override. The variant's GST
 * rate and HSN are snapshotted as checkout does (untaxed variants at 0), so converting bills the
 * line at its own rate rather than the store default. A custom item is booked against the hidden
 * "Custom item" variant with its own title, rate (store default, or 0 when untaxed) and HSN.
 */
export async function resolveLines(ctx: StoreContext, lines: DraftInput['lines']) {
  if (lines.length === 0) return []
  const customVariantId = lines.some((l) => l.custom) ? await ensureCustomItemVariant(ctx) : null
  const ids = [...new Set(lines.flatMap((l) => (l.variantId ? [l.variantId] : [])))]
  const rows =
    ids.length === 0
      ? []
      : await ctx.tx
          .select({
            id: variant.id,
            title: variant.title,
            pricePaise: variant.pricePaise,
            taxable: variant.taxable,
            gstRatePercent: effectiveGstRatePercent,
            hsCode: effectiveHsCode,
            productTitle: product.title,
            giftCard: product.isGiftCard,
          })
          .from(variant)
          .innerJoin(product, eq(product.id, variant.productId))
          .where(inArray(variant.id, ids))
  const byId = new Map(rows.map((r) => [r.id, r]))
  return lines.map((l) => {
    if (l.custom && customVariantId) {
      return {
        variantId: customVariantId,
        title: l.custom.title,
        variantTitle: null,
        quantity: l.quantity,
        unitPricePaise: l.unitPricePaise ?? 0,
        giftCard: false,
        gstRatePercent: l.custom.taxable ? null : 0,
        hsCode: l.custom.hsCode || null,
      }
    }
    const v = l.variantId ? byId.get(l.variantId) : undefined
    if (!v || !l.variantId) {
      throw new CommerceError('VARIANT_NOT_FOUND', `Variant ${l.variantId} is not in this store`)
    }
    // A variant listed without a price (#913) needs the line's own price typed in.
    const unitPricePaise = l.unitPricePaise ?? v.pricePaise
    if (unitPricePaise == null) throw new PriceNotSet(l.variantId, ctx.storeId)
    return {
      variantId: l.variantId,
      title: v.productTitle,
      variantTitle: v.title as string | null,
      quantity: l.quantity,
      unitPricePaise,
      // Snapshotted like checkout does, so routing, GST and card issue treat it as digital.
      giftCard: v.giftCard,
      gstRatePercent: v.taxable ? v.gstRatePercent : 0,
      hsCode: v.hsCode,
    }
  })
}

/**
 * A new draft takes the next draft number (#D12) and keeps minus it in `order.number` until it
 * converts, so drafts never use up order numbers (audit #26).
 */
const nextDraftNumber = (ctx: StoreContext): Promise<number> => takeDraftNumber(ctx.tx, ctx.storeId)

async function writeLines(ctx: StoreContext, orderId: string, input: DraftInput) {
  const lines = await resolveLines(ctx, input.lines)
  await ctx.tx.delete(orderLine).where(eq(orderLine.orderId, orderId))
  if (lines.length > 0) {
    await ctx.tx
      .insert(orderLine)
      .values(lines.map((l) => ({ storeId: ctx.storeId, orderId, ...l })))
  }
  return lines
}

export async function createDraft(ctx: StoreContext, input: DraftInput) {
  await assertCustomerInStore(ctx.tx, input.customerId, ctx.storeId)
  const draftNumber = await nextDraftNumber(ctx)
  const shippingAddressId = await writeAddress(ctx, input.shipping)
  const billing = await writeBilling(ctx, input)
  const [o] = await ctx.tx
    .insert(order)
    .values({
      storeId: ctx.storeId,
      number: draftPlaceholder(draftNumber),
      draftNumber,
      status: 'draft',
      customerId: input.customerId ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      shippingAddressId,
      ...billing,
      paymentMethod: input.paymentMethod ?? null,
      ...draftTerms(input),
      subtotalPaise: 0,
      shippingPaise: input.shippingPaise,
      discountLabel: input.discountLabel ?? null,
      discountPaise: 0,
      totalPaise: 0,
      tags: [DRAFT_TAG],
    })
    .returning({ id: order.id })
  if (!o) throw new CommerceError('DRAFT_INSERT_FAILED', 'draft insert returned nothing')
  const lines = await writeLines(ctx, o.id, input)
  const t = await draftMoney(ctx, lines, input)
  await ctx.tx.update(order).set(t).where(eq(order.id, o.id))
  if (input.note) await setDraftNote(ctx, o.id, input.note)
  /* `number` is the draft number: what the merchant sees as #D12 until it converts. */
  return { id: o.id, number: draftNumber, draftNumber }
}

export async function updateDraft(ctx: StoreContext, id: string, input: DraftInput) {
  const [existing] = await ctx.tx.select().from(order).where(eq(order.id, id))
  if (!existing) return null
  if (existing.status !== 'draft') throw new DraftNotEditable(id, ctx.storeId)
  await assertCustomerInStore(ctx.tx, input.customerId, ctx.storeId)
  const shippingAddressId = input.shipping
    ? await writeAddress(ctx, input.shipping)
    : existing.shippingAddressId
  const billing = await writeBilling(ctx, input)
  const lines = await writeLines(ctx, id, input)
  const t = await draftMoney(ctx, lines, input)
  const [o] = await ctx.tx
    .update(order)
    .set({
      customerId: input.customerId ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      shippingAddressId,
      ...billing,
      paymentMethod: input.paymentMethod ?? null,
      ...draftTerms(input),
      ...t,
    })
    .where(eq(order.id, id))
    .returning({ id: order.id })
  if (input.note !== undefined) await setDraftNote(ctx, id, input.note ?? '')
  // A held draft (#1030) holds its new lines; a hold that already ran out is just let go.
  if (existing.reservedUntil && existing.reservedUntil.getTime() > Date.now()) {
    await reserveDraft(ctx, id, existing.reservedUntil)
  } else {
    await releaseDraftHold(ctx, existing)
  }
  return o ?? null
}

/** The note lives in order_note so the timeline shows it once the draft converts. */
async function setDraftNote(ctx: StoreContext, orderId: string, body: string) {
  await ctx.tx
    .delete(orderNote)
    .where(and(eq(orderNote.orderId, orderId), eq(orderNote.author, DRAFT_TAG)))
  if (body.trim()) {
    await ctx.tx
      .insert(orderNote)
      .values({ storeId: ctx.storeId, orderId, body: body.trim(), author: DRAFT_TAG })
  }
}

export async function deleteDraft(ctx: StoreContext, id: string) {
  const [o] = await ctx.tx.select({ status: order.status }).from(order).where(eq(order.id, id))
  if (!o) return false
  if (o.status !== 'draft') throw new DraftNotEditable(id, ctx.storeId)
  return (await deleteDrafts(ctx, [id])) === 1
}

/**
 * Delete several drafts at once (the list's bulk action). Only rows still in `draft` go; an id
 * that converted in the meantime is left alone, and the count says how many went.
 */
export async function deleteDrafts(ctx: StoreContext, ids: readonly string[]) {
  if (ids.length === 0) return 0
  // Locked so a conversion running at the same time waits, then finds the row gone.
  const rows = await ctx.tx
    .select({ id: order.id, draftReserved: order.draftReserved })
    .from(order)
    .where(and(inArray(order.id, [...ids]), eq(order.status, 'draft')))
    .for('update')
  const draftIds = rows.map((r) => r.id)
  if (draftIds.length === 0) return 0
  // Held stock (#1030) goes back on sale with the draft.
  for (const r of rows) if (r.draftReserved?.length) await releaseReserved(ctx, r.draftReserved)
  await ctx.tx.delete(notification).where(inArray(notification.orderId, draftIds))
  await ctx.tx.delete(orderNote).where(inArray(orderNote.orderId, draftIds))
  await ctx.tx.delete(orderLine).where(inArray(orderLine.orderId, draftIds))
  await ctx.tx.delete(order).where(inArray(order.id, draftIds))
  return draftIds.length
}

/**
 * Whether any line of the draft is shipped. A gift card is the one digital product (no
 * address needed, as at checkout); every other line ships.
 */
async function draftNeedsShipping(ctx: StoreContext, orderId: string): Promise<boolean> {
  const [row] = await ctx.tx
    .select({ id: orderLine.id })
    .from(orderLine)
    .leftJoin(variant, eq(variant.id, orderLine.variantId))
    .leftJoin(product, eq(product.id, variant.productId))
    .where(
      and(
        eq(orderLine.orderId, orderId),
        eq(orderLine.giftCard, false),
        sql`coalesce(${product.isGiftCard}, false) = false`,
      ),
    )
    .limit(1)
  return Boolean(row)
}

/**
 * Turn the draft into a real order: hold the stock, record a pending payment
 * for the chosen method and flip the status. The stock guard is the same
 * conditional update placeOrder uses, so two conversions cannot oversell. A draft with a line
 * to ship needs a shipping address first (DraftNeedsShippingAddress).
 */
export async function convertDraft(
  ctx: StoreContext,
  id: string,
  opts: {
    paymentMethod?: string | undefined
    /** False only for a sale nothing ships for (a plan bill on the sales store). */
    requireShippingAddress?: boolean
  } = {},
) {
  // Locked, so a delete or a second conversion of the same draft waits for this one.
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, id)).for('update')
  if (!o) return null
  if (o.status !== 'draft') throw new DraftNotEditable(id, ctx.storeId)
  const lines = await ctx.tx.select().from(orderLine).where(eq(orderLine.orderId, id))
  if (lines.length === 0) throw new DraftEmpty(id, ctx.storeId)
  if (
    opts.requireShippingAddress !== false &&
    !o.shippingAddressId &&
    (await draftNeedsShipping(ctx, id))
  ) {
    throw new DraftNeedsShippingAddress(ctx.storeId)
  }
  /* A code on the draft counts a use now, under checkout's lock and limits, so usage limits
     and per-customer caps hold and the code's usage lists this order. Out of uses: refused
     (DiscountUnavailable), and the merchant removes the code to place it. */
  if (o.discountId) {
    await recordDiscountUse(ctx, o.discountId, {
      id,
      customerId: o.customerId,
      email: o.email,
      discountPaise: o.discountPaise,
    })
  }

  // Its own hold (#1030) is given back first, so the stock below is held once, for the order.
  await releaseDraftHold(ctx, o)
  /* Routed and held like a checkout (order/routing.ts), to the draft's shipping state; the
     stock guard queues two conversions, so they cannot oversell. Drafts never pre-order. */
  const [shipTo] = o.shippingAddressId
    ? await ctx.tx
        .select({ stateCode: address.stateCode })
        .from(address)
        .where(eq(address.id, o.shippingAddressId))
    : []
  const { parcels } = await routeAndReserve(ctx, {
    lines: lines.map((l) => ({
      key: l.id,
      variantId: l.variantId,
      quantity: l.quantity,
      giftCard: l.giftCard,
      preorder: null,
    })),
    buyerState: shipTo?.stateCode ?? null,
  })
  /* Billed like a checkout: each parcel's GST from its own GSTIN, the order's their sum. A
     draft with no shipping state is split as IGST (it cannot be proven local). */
  const [s] = await ctx.tx
    .select({ address: store.address, gstRatePercent: store.gstRatePercent, apps: store.apps })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const storeTax = parseStoreTax(s?.apps)
  const storeAddress = StoreAddressSchema.safeParse(s?.address ?? {})
  const byId = new Map(lines.map((l) => [l.id, l]))
  const billed = await taxParcels(ctx.tx, {
    parcels,
    lineOf: (key, quantity) => {
      const line = byId.get(key)
      return {
        grossPaise: quantity * (line?.unitPricePaise ?? 0),
        ratePercent:
          !line || line.giftCard
            ? 0
            : chargedGstRate(line.gstRatePercent ?? s?.gstRatePercent ?? 18, storeTax),
      }
    },
    discountPaise: o.discountPaise,
    adjustmentPaise: o.paymentAdjustmentPaise,
    shippingPaise: o.shippingPaise,
    shipToState: shipTo?.stateCode ?? null,
    storeState: storeAddress.success ? storeAddress.data.state : null,
  })
  await createFulfillmentOrders(ctx, {
    orderId: id,
    plans: parcels.map((p, i) => ({
      locationId: p.locationId,
      status: p.status,
      needsTransfer: p.needsTransfer,
      money: billed.money[i],
      lines: p.lines.map((l) => ({
        orderLineId: l.key,
        quantity: l.quantity,
        fulfilledQuantity: 0,
      })),
    })),
    fallbackRegistrationId: o.gstRegistrationId,
  })

  // Cost at sale is the variant's cost when the draft becomes an order (order/profit.ts).
  await ctx.tx
    .update(orderLine)
    .set({
      costAtSalePaise: sql`(select v.cost_paise from variant v where v.id = ${orderLine.variantId})`,
    })
    .where(and(eq(orderLine.orderId, id), eq(orderLine.giftCard, false)))

  const method = opts.paymentMethod ?? o.paymentMethod ?? 'manual'
  const placedAt = new Date()
  /* Payment due later (#1029): the clock starts now; a fixed date stays as chosen. */
  const terms = PaymentTermsSchema.safeParse(o.paymentTerms)
  const dueAt = terms.success ? paymentDueAt(terms.data, placedAt, o.paymentDueAt) : null
  /* The order number is taken only now; a draft from before 0200 keeps the one it reserved. */
  const number = isDraftPlaceholder(o.number)
    ? await takeOrderNumber(ctx.tx, ctx.storeId)
    : o.number
  const [updated] = await ctx.tx
    .update(order)
    .set({
      number,
      status: 'open',
      paymentMethod: method,
      placedAt,
      paymentDueAt: dueAt,
      ...(billed.tax
        ? {
            taxPaise: billed.tax.taxPaise,
            taxBreakdown: billed.tax,
            gstRegistrationId: billed.origin.gstRegistrationId,
            taxOrigin: billed.origin,
          }
        : {}),
    })
    .where(eq(order.id, id))
    .returning()
  await ctx.tx.insert(payment).values({
    storeId: ctx.storeId,
    orderId: id,
    provider: method,
    providerRef: `draft_${id}`,
    status: 'pending',
    amountPaise: o.totalPaise,
  })
  const result = await recomputeOrderStatuses(ctx, id)
  await announceExchangeOrder(ctx, id)
  return updated && result ? { ...updated, ...result.after } : (updated ?? null)
}
