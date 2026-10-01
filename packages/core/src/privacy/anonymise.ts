/** SOURCE OF TRUTH: customer erasure — WHAT: anonymise one customer: erase name, email, phone, saved addresses, sessions, notes and marketing contact details everywhere they are copied, while keeping what Indian tax law needs on orders and invoices (buyer name, billing and delivery address, GSTIN, amounts, items) until the retention period ends / WHY: the DPDP Act lets a shopper ask for erasure, but GST and accounting rules require invoice records for years, so erasure is anonymisation with a legal hold, done in one place and written to the audit trail */
import {
  address,
  cart,
  customer,
  customerAddress,
  customerIdentity,
  customerLoginCode,
  customerLoginTicket,
  customerOtp,
  customerPasskey,
  customerSession,
  dataRequest,
  discountUsage,
  giftCard,
  marketingAutomationRun,
  marketingMessage,
  notification,
  order,
  orderNote,
  returnRequest,
} from '@commerce/db'
import { and, eq, inArray, lt, or, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CONTACT_NOTE_PATTERN } from '../order/contact'
import { type PrivacyActor, recordPrivacyEvent } from './audit'
import { DataRequestError } from './requests'

/**
 * How long invoice data on an order is kept after the order. GST records must
 * be kept 72 months from the annual return's due date (CGST Act s. 36, Rule
 * 56); the Companies Act asks for 8 years of books. Eight years covers both.
 */
const INVOICE_RETENTION_YEARS = 8

/** What erased text reads as wherever a value cannot be null. */
const ERASED = 'Erased'

export type AnonymiseResult = {
  customerId: string
  /** Orders whose buyer name and addresses were kept for tax records. */
  ordersKept: number
  /** Orders past the retention period, fully anonymised. */
  ordersErased: number
  addressesDeleted: number
  sessionsEnded: number
}

function retentionCutoff(now: Date): Date {
  const cutoff = new Date(now)
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - INVOICE_RETENTION_YEARS)
  return cutoff
}

/**
 * Erase a customer's personal data. The customer row stays (orders, invoices
 * and refunds point at it) with every identifying field cleared and
 * `anonymised_at` set; they can no longer sign in or be messaged.
 *
 * Kept, because the law requires it while an order is inside the retention
 * period: the order's amounts, items, GSTIN and business name, and the
 * delivery address snapshot's name and address (place of supply and the
 * invoice's "billed to"). Issued GST invoices are never touched: they are
 * frozen documents. Removed from those orders: email, phone, the shopper's
 * note and marketing attribution. Orders older than the retention period
 * lose the name, address and GSTIN too.
 */
export async function anonymiseCustomer(
  ctx: StoreContext,
  input: {
    customerId: string
    actor: PrivacyActor
    dataRequestId?: string | null | undefined
    now?: Date | undefined
  },
): Promise<AnonymiseResult> {
  const now = input.now ?? new Date()
  const { tx } = ctx
  const id = input.customerId
  const [cu] = await tx
    .select({ email: customer.email, anonymisedAt: customer.anonymisedAt })
    .from(customer)
    .where(eq(customer.id, id))
  if (!cu) throw new DataRequestError('not_found', 'Customer not found')
  if (cu.anonymisedAt) throw new DataRequestError('anonymised', 'Already erased')

  // Sign-in: sessions, pending codes.
  const sessions = await tx
    .delete(customerSession)
    .where(eq(customerSession.customerId, id))
    .returning({ id: customerSession.id })
  await tx.delete(customerOtp).where(eq(customerOtp.customerId, id))
  // Every way back in goes too: provider links, passkeys and login tickets in flight.
  await tx.delete(customerIdentity).where(eq(customerIdentity.customerId, id))
  await tx.delete(customerPasskey).where(eq(customerPasskey.customerId, id))
  await tx.delete(customerLoginTicket).where(eq(customerLoginTicket.customerId, id))
  if (cu.email) await tx.delete(customerLoginTicket).where(eq(customerLoginTicket.email, cu.email))
  if (cu.email) await tx.delete(customerLoginCode).where(eq(customerLoginCode.email, cu.email))

  // Address book: nothing legal hangs on it.
  const addresses = await tx
    .delete(customerAddress)
    .where(eq(customerAddress.customerId, id))
    .returning({ id: customerAddress.id })

  // Orders: contact details go, invoice data stays inside the retention period.
  const orders = await tx
    .select({ id: order.id, placedAt: order.placedAt, shippingAddressId: order.shippingAddressId })
    .from(order)
    .where(eq(order.customerId, id))
  const cutoff = retentionCutoff(now)
  const kept = orders.filter((o) => o.placedAt >= cutoff)
  const old = orders.filter((o) => o.placedAt < cutoff)
  if (orders.length > 0) {
    await tx
      .update(order)
      .set({ email: null, phone: null, customerNote: null, attribution: null })
      .where(eq(order.customerId, id))
    const snapshotIds = orders.flatMap((o) => (o.shippingAddressId ? [o.shippingAddressId] : []))
    if (snapshotIds.length > 0) {
      // The courier phone on the delivery snapshot is not invoice data.
      await tx.update(address).set({ phone: '' }).where(inArray(address.id, snapshotIds))
    }
    const orderIds = orders.map((o) => o.id)
    // Staff contact edits quote the old and new email, phone and address on the timeline.
    await tx
      .update(orderNote)
      .set({ body: ERASED })
      .where(
        and(inArray(orderNote.orderId, orderIds), sql`${orderNote.body} ~ ${CONTACT_NOTE_PATTERN}`),
      )
    // Who each order message went to.
    await tx.update(notification).set({ to: ERASED }).where(inArray(notification.orderId, orderIds))
    await tx
      .update(returnRequest)
      .set({ customerNote: null })
      .where(
        inArray(
          returnRequest.orderId,
          orders.map((o) => o.id),
        ),
      )
  }
  if (old.length > 0) {
    await tx
      .update(order)
      .set({ buyerGstin: null, buyerBusinessName: null })
      .where(and(eq(order.customerId, id), lt(order.placedAt, cutoff)))
    const oldSnapshots = old.flatMap((o) => (o.shippingAddressId ? [o.shippingAddressId] : []))
    if (oldSnapshots.length > 0) {
      await tx
        .update(address)
        .set({ name: ERASED, line1: ERASED, line2: null, city: ERASED, pincode: '000000' })
        .where(inArray(address.id, oldSnapshots))
    }
  }

  // Copies of the contact details elsewhere.
  // Their carts, including guest ones that only carry their email.
  await tx
    .update(cart)
    .set({ email: null, phone: null, customerName: null, attribution: null })
    .where(
      cu.email ? or(eq(cart.customerId, id), eq(cart.email, cu.email)) : eq(cart.customerId, id),
    )
  await tx.update(discountUsage).set({ email: null }).where(eq(discountUsage.customerId, id))
  await tx
    .update(marketingAutomationRun)
    .set({
      email: null,
      phone: null,
      name: null,
      status: sql`case when ${marketingAutomationRun.status} = 'active' then 'stopped' else ${marketingAutomationRun.status} end`,
      stopReason: sql`coalesce(${marketingAutomationRun.stopReason}, 'erased')`,
    })
    .where(eq(marketingAutomationRun.customerId, id))
  await tx
    .update(marketingMessage)
    .set({
      to: ERASED,
      status: sql`case when ${marketingMessage.status} = 'queued' then 'skipped' else ${marketingMessage.status} end`,
    })
    .where(eq(marketingMessage.customerId, id))
  // A gift card is money owed; its code and balance stay, the names and email go.
  await tx
    .update(giftCard)
    .set({ recipientEmail: null, recipientName: null })
    .where(eq(giftCard.customerId, id))
  await tx
    .update(dataRequest)
    .set({ contactEmail: null, contactPhone: null, note: null })
    .where(eq(dataRequest.customerId, id))

  await tx
    .update(customer)
    .set({
      email: null,
      phone: null,
      phoneIndex: null,
      phoneVerifiedAt: null,
      name: null,
      defaultAddress: null,
      tags: [],
      note: null,
      acceptsMarketing: false,
      acceptsWhatsapp: false,
      acceptsSms: false,
      marketingConsentSource: null,
      unsubscribedAt: now,
      anonymisedAt: now,
      updatedAt: now,
    })
    .where(eq(customer.id, id))

  const result: AnonymiseResult = {
    customerId: id,
    ordersKept: kept.length,
    ordersErased: old.length,
    addressesDeleted: addresses.length,
    sessionsEnded: sessions.length,
  }
  await recordPrivacyEvent(ctx, {
    action: 'customer.anonymised',
    actor: input.actor,
    customerId: id,
    dataRequestId: input.dataRequestId ?? null,
    detail: {
      ordersKept: result.ordersKept,
      ordersErased: result.ordersErased,
      addressesDeleted: result.addressesDeleted,
      sessionsEnded: result.sessionsEnded,
      retentionYears: INVOICE_RETENTION_YEARS,
    },
    at: now,
  })
  return result
}
