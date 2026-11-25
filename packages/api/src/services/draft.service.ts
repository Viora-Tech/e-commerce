import {
  type AbandonedListFilters,
  abandonedStats,
  CannotShipToState,
  CommerceError,
  CUSTOM_ITEM_HANDLE,
  captureCartContact,
  checkDraftDiscountCode,
  convertDraft,
  createDraft,
  DiscountCodeRefused,
  DiscountUnavailable,
  type DraftCodeInput,
  DraftEmpty,
  type DraftInput,
  DraftInvalidGstin,
  type DraftListFilters,
  DraftNotEditable,
  deleteDraft,
  deleteDrafts,
  deliverCartRecovery,
  draftStoreCreditDue,
  duplicateOrderAsDraft,
  listAbandoned,
  listDrafts,
  markRecoverySent,
  OutOfStock,
  previewCartRecovery,
  previewDraftGst,
  RECOVERY_NO_CONSENT,
  recoveryUrl,
  STORE_CREDIT_PROVIDER,
  storefrontOriginFor,
  storeNotificationChannels,
  updateDraft,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  address,
  cart,
  customer,
  notification,
  order,
  orderLine,
  orderNote,
  payment,
  product,
  variant,
} from '@commerce/db'
import type { CustomMessage, NotificationRegistry } from '@commerce/notifications'
import { ORPCError } from '@orpc/server'
import { and, asc, count, desc, eq, isNull, or, sql } from 'drizzle-orm'
import { seenDraftIds } from './drafts-seen.service'

/**
 * Draft orders and abandoned checkouts for the admin. Core owns the rules;
 * this layer maps its errors onto RPC codes and joins the rows the pages show.
 */

const ctxOf = (tx: StoreTx, storeId: string) => ({ storeId, tx })

function draftErrorToRpc(err: unknown): never {
  if (err instanceof DraftNotEditable) {
    throw new ORPCError('CONFLICT', { message: 'This order has already been placed' })
  }
  if (err instanceof DraftEmpty) {
    throw new ORPCError('BAD_REQUEST', { message: 'Add at least one product first' })
  }
  if (err instanceof DiscountUnavailable) {
    throw new ORPCError('CONFLICT', {
      message:
        "The draft's discount code has no uses left. Remove the code and save the draft to place it.",
    })
  }
  if (err instanceof DiscountCodeRefused) {
    throw new ORPCError('CONFLICT', {
      message: `The discount code ${err.code} does not work for this customer (${err.reason.replace('_', ' ')}). Remove it and save the draft to place it.`,
    })
  }
  if (err instanceof DraftInvalidGstin) {
    throw new ORPCError('BAD_REQUEST', { message: err.message, data: { field: 'billing.gstin' } })
  }
  if (err instanceof CannotShipToState) {
    throw new ORPCError('BAD_REQUEST', {
      message: "None of your locations ships to this address's state",
    })
  }
  // Any other rule core refuses on (a product removed from the catalogue, ...) reads as itself.
  if (err instanceof CommerceError) throw new ORPCError('BAD_REQUEST', { message: err.message })
  throw err
}

/**
 * One page of drafts, each with `seen`: this member opened it since it last changed (the same
 * per-member record as the sidebar's Drafts count, `draft_seen`). The list dims seen rows.
 */
export async function listStoreDrafts(
  tx: StoreTx,
  storeId: string,
  userId: string,
  input: DraftListFilters & { page: number; perPage: number },
) {
  const page = await listDrafts(ctxOf(tx, storeId), input)
  const seen = await seenDraftIds(
    tx,
    userId,
    page.items.map((d) => d.id),
  )
  return { ...page, items: page.items.map((d) => ({ ...d, seen: seen.has(d.id) })) }
}

/** The stat cards above the drafts list: open drafts, invoices sent, and what they add up to. */
export async function draftTiles(tx: StoreTx) {
  const fromCheckout = sql`${order.draftSource} = 'checkout'`
  const [row] = await tx
    .select({
      total: count(),
      // Shoppers' unpaid checkouts waiting for payment (0233): their own tab, not "Open".
      checkout: sql<number>`count(*) filter (where ${fromCheckout})::int`.mapWith(Number),
      invoiced:
        // Qualified by hand: with no join Drizzle prints a bare "id", which inside the subquery
        // means the notification's own id, so this counted 0 while the list showed sent invoices.
        sql<number>`count(*) filter (where not ${fromCheckout} and exists (select 1 from notification n where n.order_id = "order"."id" and n.template = 'draft_invoice' and n.status = 'sent'))::int`.mapWith(
          Number,
        ),
      valuePaise: sql<number>`coalesce(sum(${order.totalPaise}), 0)::bigint`.mapWith(Number),
    })
    .from(order)
    // Checkout drafts count while they wait for payment, as the list shows them.
    .where(
      and(
        eq(order.status, 'draft'),
        or(sql`${order.draftSource} is distinct from 'checkout'`, isNull(order.draftExpiredAt)),
      ),
    )
  const total = row?.total ?? 0
  const invoiced = row?.invoiced ?? 0
  const checkout = row?.checkout ?? 0
  return {
    open: total - invoiced - checkout,
    invoiced,
    checkout,
    total,
    valuePaise: row?.valuePaise ?? 0,
  }
}

/** The draft plus everything its editor needs: lines with titles, address, note. */
export async function getDraft(tx: StoreTx, id: string) {
  const [o] = await tx
    .select()
    .from(order)
    .where(and(eq(order.id, id), eq(order.status, 'draft')))
  if (!o) return null
  const [lines, notes] = await Promise.all([
    tx
      .select({
        id: orderLine.id,
        variantId: orderLine.variantId,
        title: orderLine.title,
        variantTitle: orderLine.variantTitle,
        quantity: orderLine.quantity,
        unitPricePaise: orderLine.unitPricePaise,
        sku: variant.sku,
        gstRatePercent: orderLine.gstRatePercent,
        hsCode: orderLine.hsCode,
        /** A one-off custom item (the hidden "Custom item" product), not a catalogue variant. */
        custom: sql<boolean>`coalesce(${product.handle} = ${CUSTOM_ITEM_HANDLE} and ${product.isSystemTest}, false)`,
        /** A gift card ships nothing; every other line needs a shipping address to convert. */
        giftCard: sql<boolean>`(${orderLine.giftCard} or coalesce(${product.isGiftCard}, false))`,
      })
      .from(orderLine)
      .leftJoin(variant, eq(variant.id, orderLine.variantId))
      .leftJoin(product, eq(product.id, variant.productId))
      .where(eq(orderLine.orderId, id))
      .orderBy(asc(orderLine.id)),
    tx.select().from(orderNote).where(eq(orderNote.orderId, id)).orderBy(asc(orderNote.createdAt)),
  ])
  const [cust] = o.customerId
    ? await tx.select().from(customer).where(eq(customer.id, o.customerId))
    : []
  const [ship] = o.shippingAddressId
    ? await tx.select().from(address).where(eq(address.id, o.shippingAddressId))
    : []
  const [bill] = o.billingAddressId
    ? await tx.select().from(address).where(eq(address.id, o.billingAddressId))
    : []
  // A shopper's unpaid checkout (0233): its payment tries, newest first, for the draft page.
  const attempts =
    o.draftSource === 'checkout'
      ? await tx
          .select({
            id: payment.id,
            attempt: payment.attempt,
            provider: payment.provider,
            status: payment.status,
            error: payment.error,
            amountPaise: payment.amountPaise,
            refundNeeded: payment.refundNeeded,
            createdAt: payment.createdAt,
          })
          .from(payment)
          .where(eq(payment.orderId, id))
          .orderBy(desc(payment.attempt), desc(payment.createdAt))
      : []
  // Store credit staff applied to a staff draft, taken from the balance when it converts.
  const [credit] =
    o.draftSource === 'checkout'
      ? []
      : await tx
          .select({ amountPaise: payment.amountPaise })
          .from(payment)
          .where(
            and(
              eq(payment.orderId, id),
              eq(payment.provider, STORE_CREDIT_PROVIDER),
              eq(payment.status, 'created'),
            ),
          )
  return {
    ...o,
    lines,
    attempts,
    storeCreditPaise: credit?.amountPaise ?? 0,
    /** Its timeline: system and staff lines (payment link sent), not the draft's own `draft` note. */
    timeline: notes
      .filter((n) => n.author !== 'draft')
      .map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt })),
    note: notes.find((n) => n.author === 'draft')?.body ?? '',
    customer: cust ?? null,
    shippingAddress: ship ?? null,
    /** Null: billing is the shipping address. */
    billingAddress: bill ?? null,
  }
}

export async function saveDraft(
  tx: StoreTx,
  storeId: string,
  input: { id?: string | undefined; draft: DraftInput },
) {
  try {
    if (input.id) {
      // A shopper's checkout is kept as they checked it out: its payment is already asked for.
      const [head] = await tx
        .select({ draftSource: order.draftSource })
        .from(order)
        .where(eq(order.id, input.id))
      if (head?.draftSource === 'checkout') {
        throw new ORPCError('BAD_REQUEST', {
          message: 'Choose Edit on this unpaid checkout first: it stops the old payment link.',
        })
      }
      const row = await updateDraft(ctxOf(tx, storeId), input.id, input.draft)
      if (!row) throw new ORPCError('NOT_FOUND', { message: 'Draft not found' })
      return { id: input.id }
    }
    const created = await createDraft(ctxOf(tx, storeId), input.draft)
    return { id: created.id }
  } catch (err) {
    draftErrorToRpc(err)
  }
}

/** The "Apply discount code" check on the draft editor; nothing is written. */
export const checkStoreDraftDiscount = (tx: StoreTx, storeId: string, input: DraftCodeInput) =>
  checkDraftDiscountCode(ctxOf(tx, storeId), input)

/** The draft editor's "GST (estimated)" line for the lines as typed; nothing is saved. */
export async function estimateStoreDraftGst(
  tx: StoreTx,
  storeId: string,
  input: Parameters<typeof previewDraftGst>[1],
) {
  try {
    return await previewDraftGst(ctxOf(tx, storeId), input)
  } catch (err) {
    draftErrorToRpc(err)
  }
}

/** "Duplicate order": a new draft from the order, opened in the draft editor. */
export async function duplicateStoreOrder(tx: StoreTx, storeId: string, orderId: string) {
  try {
    const draft = await duplicateOrderAsDraft(ctxOf(tx, storeId), orderId)
    if (!draft) throw new ORPCError('NOT_FOUND', { message: 'Order not found' })
    return draft
  } catch (err) {
    draftErrorToRpc(err)
  }
}

export async function removeDraft(tx: StoreTx, storeId: string, id: string) {
  try {
    return { deleted: await deleteDraft(ctxOf(tx, storeId), id) }
  } catch (err) {
    draftErrorToRpc(err)
  }
}

/** The list's bulk delete: drafts only, so an order placed from one of them is never removed. */
export async function removeDrafts(tx: StoreTx, storeId: string, ids: string[]) {
  return { deleted: await deleteDrafts(ctxOf(tx, storeId), ids) }
}

/** "Not enough stock of Glasspad / Black": the line the shortfall is on, by name. */
async function outOfStockMessage(tx: StoreTx, orderId: string, variantId: string) {
  const [line] = await tx
    .select({ title: orderLine.title, variantTitle: orderLine.variantTitle })
    .from(orderLine)
    .where(and(eq(orderLine.orderId, orderId), eq(orderLine.variantId, variantId)))
  const name =
    line?.variantTitle && line.variantTitle !== 'Default'
      ? `${line.title} / ${line.variantTitle}`
      : line?.title
  return name
    ? `Not enough stock of ${name} to place this order`
    : 'Not enough stock to place this order'
}

export async function convertStoreDraft(
  tx: StoreTx,
  storeId: string,
  input: { id: string; paymentMethod?: string | undefined },
) {
  try {
    const row = await convertDraft(ctxOf(tx, storeId), input.id, {
      paymentMethod: input.paymentMethod,
    })
    if (!row) throw new ORPCError('NOT_FOUND', { message: 'Draft not found' })
    return row
  } catch (err) {
    if (err instanceof OutOfStock) {
      throw new ORPCError('BAD_REQUEST', {
        message: await outOfStockMessage(tx, input.id, err.variantId),
      })
    }
    draftErrorToRpc(err)
  }
}

/** Marks the invoice as sent so the list can show it; the message itself goes through the queue. */
export async function recordInvoiceSent(tx: StoreTx, storeId: string, orderId: string, to: string) {
  await tx
    .insert(notification)
    .values({
      storeId,
      orderId,
      channel: 'invoice',
      template: 'draft_invoice',
      to,
      status: 'sent',
    })
    .onConflictDoUpdate({
      target: [notification.orderId, notification.channel, notification.template],
      set: { status: 'sent', createdAt: new Date() },
    })
}

export const listStoreAbandoned = (
  tx: StoreTx,
  storeId: string,
  input: AbandonedListFilters & { page: number; perPage: number },
) => listAbandoned(ctxOf(tx, storeId), input)

export const storeAbandonedStats = (tx: StoreTx, storeId: string, days?: number) =>
  abandonedStats(ctxOf(tx, storeId), { days })

export { captureCartContact }

/** Send one recovery message now, from the admin's row action. */
export async function sendRecovery(
  tx: StoreTx,
  storeId: string,
  input: {
    cartId: string
    /** The merchant's edited subject and note from the "Review email" dialog. */
    custom?: CustomMessage | undefined
    registry: NotificationRegistry
    settingsSecret: string
    /** STOREFRONT_URL: the fallback when the store has no live primary domain. */
    storefrontUrl: string
  },
) {
  const ctx = ctxOf(tx, storeId)
  const origin = await storefrontOriginFor(tx, storeId, input.storefrontUrl)
  const results = await deliverCartRecovery(
    ctx,
    {
      cartId: input.cartId,
      actionUrl: recoveryUrl(input.cartId, input.settingsSecret, origin),
      custom: input.custom,
    },
    { registry: input.registry, settingsSecret: input.settingsSecret },
  )
  if (results.some((r) => r.ok)) await markRecoverySent(ctx, input.cartId)
  if (results.length === 0) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: 'Enable an email or WhatsApp channel in Settings first',
    })
  }
  if (results.every((r) => r.error === RECOVERY_NO_CONSENT)) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: 'This customer has not agreed to marketing messages, so no recovery was sent',
    })
  }
  return { sent: results.filter((r) => r.ok).length, results }
}

/**
 * The email on a draft, for a bulk invoice send; null when it is not a draft, has none, or store
 * credit pays all of it (nothing to invoice). The credit counts as the convert would take it:
 * capped at the customer's balance now.
 */
export async function draftEmail(tx: StoreTx, storeId: string, id: string): Promise<string | null> {
  const [o] = await tx
    .select({ email: order.email, totalPaise: order.totalPaise })
    .from(order)
    .where(and(eq(order.id, id), eq(order.status, 'draft')))
  if (!o) return null
  const creditPaise = await draftStoreCreditDue(ctxOf(tx, storeId), id)
  if (creditPaise > 0 && creditPaise >= o.totalPaise) return null
  return o.email ?? null
}

/** The abandoned checkout's reminder as the shopper would get it, for the "Review email" dialog. */
export async function previewRecovery(
  tx: StoreTx,
  storeId: string,
  input: {
    cartId: string
    custom?: CustomMessage | undefined
    registry: NotificationRegistry
    settingsSecret: string
    storefrontUrl: string
  },
) {
  const ctx = ctxOf(tx, storeId)
  const origin = await storefrontOriginFor(tx, storeId, input.storefrontUrl)
  const channels = await storeNotificationChannels(tx, storeId, {
    registry: input.registry,
    settingsSecret: input.settingsSecret,
  })
  const preview = await previewCartRecovery(
    ctx,
    { cartId: input.cartId, custom: input.custom },
    {
      actionUrl: recoveryUrl(input.cartId, input.settingsSecret, origin),
      whatsapp: channels.some((c) => c.requires === 'phone'),
    },
  )
  if (!preview) throw new ORPCError('NOT_FOUND', { message: 'Checkout not found' })
  return preview
}
