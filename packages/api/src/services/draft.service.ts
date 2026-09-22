import {
  abandonedStats,
  captureCartContact,
  convertDraft,
  createDraft,
  DraftEmpty,
  type DraftInput,
  DraftNotEditable,
  deleteDraft,
  deliverCartRecovery,
  listAbandoned,
  listDrafts,
  markRecoverySent,
  recoveryUrl,
  updateDraft,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { address, customer, notification, order, orderLine, orderNote, variant } from '@commerce/db'
import type { NotificationRegistry } from '@commerce/notifications'
import { ORPCError } from '@orpc/server'
import { and, asc, eq } from 'drizzle-orm'

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
  throw err
}

export const listStoreDrafts = (
  tx: StoreTx,
  storeId: string,
  input: { page: number; perPage: number; search?: string | undefined },
) => listDrafts(ctxOf(tx, storeId), input)

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
      })
      .from(orderLine)
      .leftJoin(variant, eq(variant.id, orderLine.variantId))
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
  input: { page: number; perPage: number; sinceDays?: number | undefined },
) => listAbandoned(ctxOf(tx, storeId), input)

export const storeAbandonedStats = (tx: StoreTx, storeId: string) =>
  abandonedStats(ctxOf(tx, storeId))

export { captureCartContact }

/** Send one recovery message now, from the admin's row action. */
export async function sendRecovery(
  tx: StoreTx,
  storeId: string,
  input: {
    cartId: string
    registry: NotificationRegistry
    settingsSecret: string
    storefrontUrl: string
  },
) {
  const ctx = ctxOf(tx, storeId)
  const results = await deliverCartRecovery(
    ctx,
    {
      cartId: input.cartId,
      actionUrl: recoveryUrl(input.cartId, input.settingsSecret, input.storefrontUrl),
    },
    { registry: input.registry, settingsSecret: input.settingsSecret },
  )
  if (results.some((r) => r.ok)) await markRecoverySent(ctx, input.cartId)
  if (results.length === 0) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: 'Enable an email or WhatsApp channel in Settings first',
    })
  }
  return { sent: results.filter((r) => r.ok).length, results }
}
