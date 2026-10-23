import {
  type AbandonedListStatus,
  abandonedStats,
  CannotShipToState,
  CommerceError,
  captureCartContact,
  convertDraft,
  createDraft,
  DraftEmpty,
  type DraftInput,
  type DraftListStatus,
  DraftNotEditable,
  deleteDraft,
  deleteDrafts,
  deliverCartRecovery,
  listAbandoned,
  listDrafts,
  markRecoverySent,
  OutOfStock,
  previewCartRecovery,
  RECOVERY_NO_CONSENT,
  recoveryUrl,
  storefrontOriginFor,
  storeNotificationChannels,
  updateDraft,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  address,
  cart,
  cartLine,
  customer,
  media,
  notification,
  order,
  orderLine,
  orderNote,
  product,
  productMedia,
  variant,
} from '@commerce/db'
import type { CustomMessage, NotificationRegistry } from '@commerce/notifications'
import { ORPCError } from '@orpc/server'
import { and, asc, count, eq, sql } from 'drizzle-orm'

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
  if (err instanceof CannotShipToState) {
    throw new ORPCError('BAD_REQUEST', {
      message: "None of your locations ships to this address's state",
    })
  }
  // Any other rule core refuses on (a product removed from the catalogue, ...) reads as itself.
  if (err instanceof CommerceError) throw new ORPCError('BAD_REQUEST', { message: err.message })
  throw err
}

export const listStoreDrafts = (
  tx: StoreTx,
  storeId: string,
  input: {
    page: number
    perPage: number
    search?: string | undefined
    status?: DraftListStatus | undefined
  },
) => listDrafts(ctxOf(tx, storeId), input)

/** The stat cards above the drafts list: open drafts, invoices sent, and what they add up to. */
export async function draftTiles(tx: StoreTx) {
  const [row] = await tx
    .select({
      total: count(),
      invoiced:
        sql<number>`count(*) filter (where exists (select 1 from notification n where n.order_id = ${order.id} and n.template = 'draft_invoice' and n.status = 'sent'))::int`.mapWith(
          Number,
        ),
      valuePaise: sql<number>`coalesce(sum(${order.totalPaise}), 0)::bigint`.mapWith(Number),
    })
    .from(order)
    .where(eq(order.status, 'draft'))
  const total = row?.total ?? 0
  const invoiced = row?.invoiced ?? 0
  return { open: total - invoiced, invoiced, total, valuePaise: row?.valuePaise ?? 0 }
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
  return {
    ...o,
    lines,
    note: notes.find((n) => n.author === 'draft')?.body ?? '',
    customer: cust ?? null,
    shippingAddress: ship ?? null,
  }
}

export async function saveDraft(
  tx: StoreTx,
  storeId: string,
  input: { id?: string | undefined; draft: DraftInput },
) {
  try {
    if (input.id) {
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
  input: {
    page: number
    perPage: number
    sinceDays?: number | undefined
    status?: AbandonedListStatus | undefined
    search?: string | undefined
  },
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
 * One abandoned checkout for its detail page: the contact, each line with its photo and
 * price, the timestamps the activity list needs, and a fresh signed recovery link.
 */
export async function getStoreAbandoned(
  tx: StoreTx,
  storeId: string,
  cartId: string,
  link: { settingsSecret: string; storefrontUrl: string },
) {
  const [row] = await tx.select().from(cart).where(eq(cart.id, cartId))
  if (!row) throw new ORPCError('NOT_FOUND', { message: 'Checkout not found' })
  const lines = await tx
    .select({
      id: cartLine.id,
      quantity: cartLine.quantity,
      unitPricePaise: cartLine.unitPricePaise,
      productTitle: product.title,
      variantTitle: variant.title,
      image: sql<string | null>`coalesce(${media.url}, (
        select m.url from ${productMedia} pm join ${media} m on m.id = pm.media_id
        where pm.product_id = ${variant.productId} order by pm.position limit 1))`,
    })
    .from(cartLine)
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(media, eq(media.id, variant.mediaId))
    .where(eq(cartLine.cartId, cartId))
    .orderBy(asc(cartLine.id))
  const origin = await storefrontOriginFor(tx, storeId, link.storefrontUrl)
  const recovered = row.status === 'converted'
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    customerName: row.customerName,
    discountCode: row.discountCode,
    source: row.attribution?.source ?? row.attribution?.channel ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    recoverySentAt: row.recoverySentAt,
    recovered,
    lines: lines.map((l) => ({ ...l, totalPaise: l.quantity * l.unitPricePaise })),
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotalPaise: lines.reduce((n, l) => n + l.quantity * l.unitPricePaise, 0),
    /** Not offered for a cart that already became an order: the link would show an empty basket. */
    recoveryUrl: recovered ? null : recoveryUrl(row.id, link.settingsSecret, origin),
  }
}

/** The email on a draft, for a bulk invoice send; null when it is not a draft or has none. */
export async function draftEmail(tx: StoreTx, id: string): Promise<string | null> {
  const [o] = await tx
    .select({ email: order.email })
    .from(order)
    .where(and(eq(order.id, id), eq(order.status, 'draft')))
  return o?.email ?? null
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
