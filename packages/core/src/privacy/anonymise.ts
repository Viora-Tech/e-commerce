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
  newsletterSignup,
  notification,
  order,
  orderNote,
  returnRequest,
  shipment,
  shipmentWebhookEvent,
} from '@commerce/db'
import type { StorageProvider } from '@commerce/storage'
import { and, eq, inArray, lt, or, sql } from 'drizzle-orm'
import { phoneLoginOtpKey } from '../accounts/otp'
import { normaliseMobile } from '../accounts/schemas'
import type { StoreContext } from '../context'
import { decryptCustomerPhone } from '../customers/phone-crypto'
import { deleteMetafieldsOf } from '../metaobjects/service'
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
  /** Return photo files removed from storage. */
  returnPhotosDeleted: number
  /** Return photo files storage could not remove (the links on the returns are gone either way). */
  returnPhotosFailed: number
}

/** What erasure needs from the store's storage connection: removing return photos. */
export type ErasureStorage = Pick<StorageProvider, 'delete' | 'publicUrl'>

/** Courier tracking reduced to what the merchant needs: where the parcel stands, and when. */
function scrubTracking(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw ?? null
  const t = raw as { waybill?: unknown; status?: unknown; events?: unknown; expectedDate?: unknown }
  const events = Array.isArray(t.events)
    ? t.events.map((e) => {
        const ev = (e ?? {}) as { at?: unknown; status?: unknown }
        return { at: ev.at, status: ev.status, description: ERASED }
      })
    : []
  return { waybill: t.waybill, status: t.status, events, expectedDate: t.expectedDate }
}

/** A public photo URL back to its storage key, only for this store's returns folder. */
function returnPhotoKey(url: string, storeId: string, storage: ErasureStorage): string | null {
  const folder = `stores/${storeId}/returns/`
  const prefix = storage.publicUrl(folder)
  if (!url.startsWith(prefix)) return null
  const rest = url.slice(prefix.length).split(/[?#]/)[0] ?? ''
  if (!rest || rest.includes('..') || rest.includes('/')) return null
  return `${folder}${rest}`
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
 * lose the name, address and GSTIN too. Also gone: return photos (links and,
 * through `storage`, the files), courier tracking text and webhook payloads
 * (each scan keeps only its status and time), phone sign-in codes for their
 * number (needs `secret`) and back-in-stock signups for their email or number.
 */
export async function anonymiseCustomer(
  ctx: StoreContext,
  input: {
    customerId: string
    actor: PrivacyActor
    dataRequestId?: string | null | undefined
    now?: Date | undefined
    /** SETTINGS_SECRET: reads the stored phone so codes and alerts sent to it go too. */
    secret?: string | undefined
    /** The store's storage connection: return photo files are deleted through it. */
    storage?: ErasureStorage | null | undefined
  },
): Promise<AnonymiseResult> {
  const now = input.now ?? new Date()
  const { tx } = ctx
  const id = input.customerId
  const [cu] = await tx
    .select({ email: customer.email, phone: customer.phone, anonymisedAt: customer.anonymisedAt })
    .from(customer)
    .where(eq(customer.id, id))
  if (!cu) throw new DataRequestError('not_found', 'Customer not found')
  if (cu.anonymisedAt) throw new DataRequestError('anonymised', 'Already erased')
  const rawPhone = input.secret ? decryptCustomerPhone(cu.phone, input.secret) : null
  const mobile = rawPhone ? normaliseMobile(rawPhone) : null

  // Sign-in: sessions, pending codes (account deletion codes carry the customer id; phone
  // sign-in codes are keyed by the number only).
  const sessions = await tx
    .delete(customerSession)
    .where(eq(customerSession.customerId, id))
    .returning({ id: customerSession.id })
  await tx.delete(customerOtp).where(eq(customerOtp.customerId, id))
  if (mobile) {
    await tx
      .delete(customerOtp)
      .where(eq(customerOtp.destinationHash, phoneLoginOtpKey(ctx.storeId, mobile)))
  }
  // Every way back in goes too: provider links, passkeys and login tickets in flight.
  await tx.delete(customerIdentity).where(eq(customerIdentity.customerId, id))
  await tx.delete(customerPasskey).where(eq(customerPasskey.customerId, id))
  await tx.delete(customerLoginTicket).where(eq(customerLoginTicket.customerId, id))
  if (cu.email) await tx.delete(customerLoginTicket).where(eq(customerLoginTicket.email, cu.email))
  if (cu.email) await tx.delete(customerLoginCode).where(eq(customerLoginCode.email, cu.email))

  // Extra fields on the customer may hold anything the merchant chose to record about them.
  await deleteMetafieldsOf(tx, 'customer', [id])

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
  const photoUrls: string[] = []
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
    // Returns: the shopper's note and their photos (rows and files).
    const returns = await tx
      .select({ photos: returnRequest.photos })
      .from(returnRequest)
      .where(inArray(returnRequest.orderId, orderIds))
    photoUrls.push(...returns.flatMap((r) => r.photos))
    await tx
      .update(returnRequest)
      .set({ customerNote: null, photos: [] })
      .where(inArray(returnRequest.orderId, orderIds))
    // Courier tracking and webhook payloads may carry the consignee's name, phone and
    // address; the merchant keeps only each scan's status and time.
    const shipments = await tx
      .select({ id: shipment.id, waybill: shipment.waybill, tracking: shipment.tracking })
      .from(shipment)
      .where(inArray(shipment.orderId, orderIds))
    for (const s of shipments) {
      if (s.tracking) {
        await tx
          .update(shipment)
          .set({ tracking: scrubTracking(s.tracking) })
          .where(eq(shipment.id, s.id))
      }
    }
    const waybills = [...new Set(shipments.map((s) => s.waybill))]
    if (waybills.length > 0) {
      await tx
        .update(shipmentWebhookEvent)
        .set({
          payload: sql`jsonb_build_object('waybill', ${shipmentWebhookEvent.waybill}, 'eventId', ${shipmentWebhookEvent.eventId})`,
        })
        .where(inArray(shipmentWebhookEvent.waybill, waybills))
    }
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
  // Back-in-stock "notify me" signups for their email or number. The table belongs to the
  // back-in-stock app but is created by the core migrations (0060) and is under RLS, so it
  // is cleared here by name rather than making core depend on the plugin package.
  const contacts = [
    cu.email ? sql`lower(email) = ${cu.email.toLowerCase()}` : null,
    mobile ? sql`right(phone, 10) = ${mobile}` : null,
  ].filter((c) => c !== null)
  if (contacts.length > 0) {
    await tx.execute(
      sql`delete from back_in_stock_signup where store_id = ${ctx.storeId} and (${sql.join(contacts, sql` or `)})`,
    )
  }
  // Newsletter signups (pending or confirmed) for their email: the proof of opt-in goes too.
  if (cu.email) {
    await tx.delete(newsletterSignup).where(eq(newsletterSignup.email, cu.email.toLowerCase()))
    // Messages they sent from a theme's contact form (Forms app, same plain-SQL reason as above).
    await tx.execute(
      sql`delete from contact_message where store_id = ${ctx.storeId} and lower(email) = ${cu.email.toLowerCase()}`,
    )
    // Reviews app (same plain-SQL reason): no more review emails, and their reviews stay
    // as anonymous text without the email, name or account link.
    await tx.execute(
      sql`delete from review_request where store_id = ${ctx.storeId} and lower(email) = ${cu.email.toLowerCase()}`,
    )
    await tx.execute(
      sql`update review set reviewer_email = null, reviewer_name = 'A customer', customer_id = null where store_id = ${ctx.storeId} and (lower(reviewer_email) = ${cu.email.toLowerCase()} or customer_id = ${input.customerId})`,
    )
  }
  // Affiliates app (same plain-SQL reason): an affiliate record of theirs keeps its commissions
  // and payouts (the merchant's books, TDS), but the person goes: name, email, phone index, what
  // they wrote, the encrypted payout details and PAN, and the account link. It stops earning and
  // its discount code is switched off.
  const affiliateOf = cu.email
    ? sql`(customer_id = ${input.customerId} or lower(email) = ${cu.email.toLowerCase()})`
    : sql`customer_id = ${input.customerId}`
  await tx.execute(
    sql`update discount set status = 'disabled', updated_at = now() where store_id = ${ctx.storeId} and id in (select discount_id from affiliate where store_id = ${ctx.storeId} and ${affiliateOf})`,
  )
  await tx.execute(
    sql`update affiliate set name = 'Former affiliate', email = null, phone_index = null, social = '', message = '', note = '', payout_method = null, payout_details = null, payout_hint = null, has_pan = false, customer_id = null, status = 'suspended', updated_at = now() where store_id = ${ctx.storeId} and ${affiliateOf}`,
  )
  // As a buyer: their orders stay credited to the affiliate, without the link back to them.
  await tx.execute(
    sql`update affiliate_commission set customer_id = null where store_id = ${ctx.storeId} and customer_id = ${input.customerId}`,
  )

  await tx
    .update(customer)
    .set({
      email: null,
      phone: null,
      phoneIndex: null,
      phoneVerifiedAt: null,
      name: null,
      gstin: null,
      businessName: null,
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

  // Return photo files. A missing object is fine (delete is idempotent); a storage error
  // is counted, not thrown: the returns no longer link to the file either way.
  let returnPhotosDeleted = 0
  let returnPhotosFailed = 0
  for (const url of new Set(photoUrls)) {
    const key = input.storage ? returnPhotoKey(url, ctx.storeId, input.storage) : null
    if (!key || !input.storage) {
      returnPhotosFailed += 1
      continue
    }
    try {
      await input.storage.delete(key)
      returnPhotosDeleted += 1
    } catch {
      returnPhotosFailed += 1
    }
  }

  const result: AnonymiseResult = {
    customerId: id,
    ordersKept: kept.length,
    ordersErased: old.length,
    addressesDeleted: addresses.length,
    sessionsEnded: sessions.length,
    returnPhotosDeleted,
    returnPhotosFailed,
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
      returnPhotosDeleted,
      returnPhotosFailed,
      retentionYears: INVOICE_RETENTION_YEARS,
    },
    at: now,
  })
  return result
}
