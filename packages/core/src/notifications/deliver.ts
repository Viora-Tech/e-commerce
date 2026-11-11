import {
  cart,
  cartLine,
  customer,
  media,
  newsletterSignup,
  notification,
  order,
  orderLine,
  payment,
  product,
  shipment,
  store,
  variant,
} from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type {
  Attachment,
  CustomMessage,
  NotificationChannel,
  NotificationRegistry,
  Recipient,
  TemplateData,
  TemplateId,
} from '@commerce/notifications'
import { and, desc, eq, inArray, ne, or, sql } from 'drizzle-orm'
import { codConfirmDelivery } from '../cod-rto/confirm'
import type { StoreContext } from '../context'
import { newsletterConfirmToken, newsletterConfirmUrl } from '../customers/newsletter'
import { phoneBlindIndex } from '../customers/phone-crypto'
import { storefrontOriginFor } from '../domains/origin'
import { mayNudgeKnownContact, phoneLookupVariants } from '../marketing/recipient'
import { isOpenCheckoutDraft } from '../order/checkout-draft'
import { orderParcelsView } from '../order/parcel-view'
import { SPLIT_TENDER_PROVIDERS } from '../payments/split-tender'
import { balanceOwed } from '../preorder/balance'
import { balanceUrl, invoiceUrl, thankYouUrl } from '../preorder/balance-link'
import { parsePreorderStoreSettings } from '../preorder/store-settings'
import { returnTemplateData } from '../returns/notify'
import { storeNotificationChannels } from '../sender-email/channels'
import { balanceData } from './balance-data'
import {
  BALANCE_ASKS,
  emailParcels,
  MERCHANT_TEMPLATES,
  merchantNotice,
  PAYMENT_LABELS,
  refundTemplateData,
  taxLines,
} from './deliver-data'
import { emailPicture, productCoverImages } from './email-images'
import { isMessageOn } from './messages'
import { paymentInstructionsOf } from './payment-instructions'
import { parseNotificationSettings } from './settings'
import { storeCreditTemplateData } from './store-credit-data'

export type DeliveryResult = {
  channel: string
  to: string
  ok: boolean
  error?: string | undefined
}

export type DeliverOptions = {
  registry: NotificationRegistry
  settingsSecret: string
  /**
   * Platform storefront URL (`STOREFRONT_URL`), the fallback for order links when the store
   * has no live primary domain (`storefrontOriginFor`). Optional.
   */
  storefrontUrl?: string | undefined
  /** Override channel resolution; tests inject fakes here. */
  channels?: NotificationChannel[] | undefined
  /** Send again even to channels that already sent this template (a copy on request). */
  resend?: boolean | undefined
  /** Only channels that need this recipient field, e.g. email for a file. */
  requires?: 'email' | 'phone' | undefined
  /** Extra template fields, e.g. the document label of a copy. */
  data?: Partial<TemplateData> | undefined
  /** Links and files installed apps add to this order email (invoice link, invoice PDF). */
  extras?:
    | ((input: { orderId: string; template: TemplateId }) => Promise<{
        links: { label: string; url: string }[]
        attachments: Attachment[]
      }>)
    | undefined
}

/** Load everything a template needs from the order. Null when the order is not visible. */
export async function buildTemplateData(
  ctx: StoreContext,
  orderId: string,
  storefrontUrl?: string,
  settingsSecret?: string,
): Promise<{ data: TemplateData; to: Recipient } | null> {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId))
  if (!o) return null
  const [s] = await ctx.tx
    .select({ name: store.name, preorder: store.preorder })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const lines = await ctx.tx
    .select({
      title: orderLine.title,
      variantTitle: orderLine.variantTitle,
      quantity: orderLine.quantity,
      unitPricePaise: orderLine.unitPricePaise,
      preorderNote: orderLine.preorderNote,
      productId: variant.productId,
      variantImage: media.url,
    })
    .from(orderLine)
    .leftJoin(variant, eq(variant.id, orderLine.variantId))
    .leftJoin(media, and(eq(media.id, variant.mediaId), emailPicture))
    .where(eq(orderLine.orderId, orderId))
  const productIds = [...new Set(lines.map((l) => l.productId).filter((id): id is string => !!id))]
  const covers = await productCoverImages(ctx.tx, productIds)
  const [cu] = o.customerId
    ? await ctx.tx.select().from(customer).where(eq(customer.id, o.customerId))
    : []
  const [ship] = await ctx.tx
    .select({
      waybill: shipment.waybill,
      trackingUrl: shipment.trackingUrl,
      ndrReason: shipment.ndrReason,
    })
    .from(shipment)
    // The live booking, newest first: a label cancelled and booked again carries the new AWB.
    .where(and(eq(shipment.orderId, orderId), ne(shipment.status, 'cancelled')))
    .orderBy(desc(shipment.createdAt))
    .limit(1)
  const method = o.paymentMethod ?? ''
  const parcels = emailParcels(await orderParcelsView(ctx.tx, orderId))
  // An unpaid UPI / bank transfer order: the details to pay to, as the thank-you page shows them.
  const [transfer] =
    method === 'manual' && !o.checkoutPaidAt
      ? await ctx.tx
          .select({ session: payment.checkoutSession })
          .from(payment)
          .where(and(eq(payment.orderId, orderId), eq(payment.provider, 'manual')))
          .orderBy(desc(payment.attempt))
          .limit(1)
      : []
  const paymentInstructions = paymentInstructionsOf(transfer?.session)
  return {
    data: {
      storeName: s?.name ?? '',
      orderNumber: o.number,
      /* Still a draft (an invoice): it goes by its #D number, it has no order number yet. */
      ...(o.status === 'draft' && o.draftNumber ? { draftNumber: o.draftNumber } : {}),
      customerName: cu?.name || 'there',
      totalLabel: formatMoney(o.totalPaise),
      lines: lines.map((l) => ({
        title: [l.title, l.variantTitle !== 'Default' ? l.variantTitle : null]
          .filter(Boolean)
          .join(' / '),
        quantity: l.quantity,
        priceLabel: formatMoney(l.quantity * l.unitPricePaise),
        imageUrl:
          l.variantImage ?? (l.productId ? covers.get(l.productId) : undefined) ?? undefined,
        ...(l.preorderNote ? { note: l.preorderNote } : {}),
      })),
      // Named after the rate ("Bluedart"), so an edit that changed the rate shows the new one.
      shipping:
        o.shippingPaise > 0
          ? { label: o.shippingRateName || 'Shipping', amount: formatMoney(o.shippingPaise) }
          : undefined,
      taxBreakdown: taxLines(o),
      ...(parcels ? { parcels } : {}),
      paymentMethodLabel: PAYMENT_LABELS[method] ?? method,
      ...(paymentInstructions ? { paymentInstructions } : {}),
      orderUrl:
        storefrontUrl && settingsSecret
          ? thankYouUrl(o.id, o.number, settingsSecret, storefrontUrl)
          : undefined,
      waybill: ship?.waybill ?? undefined,
      trackingUrl: ship?.trackingUrl ?? undefined,
      deliveryIssue: ship?.ndrReason ? { reasonLabel: ship.ndrReason } : undefined,
      balance: balanceData(o, parsePreorderStoreSettings(s?.preorder)),
    },
    to: { email: o.email ?? undefined, phone: o.phone ?? undefined },
  }
}

/** The store's enabled channels, unless the caller injected fakes. */
export async function channelsFor(ctx: StoreContext, opts: DeliverOptions) {
  if (opts.channels) return opts.channels
  return storeNotificationChannels(ctx.tx, ctx.storeId, {
    registry: opts.registry,
    settingsSecret: opts.settingsSecret,
  })
}

/** Whether the store still sends this template (see `isMessageOn`). */
export async function messageOn(ctx: StoreContext, template: TemplateId): Promise<boolean> {
  const [s] = await ctx.tx
    .select({ notifications: store.notifications })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  return isMessageOn(parseNotificationSettings(s?.notifications), template)
}

/**
 * The newsletter confirm email (double opt-in, security audit D-09): one email to the
 * address that signed up, with the link to the confirm page. Nothing goes out for a signup
 * that was confirmed or expired meanwhile. Email channels only; never marketing, so no
 * consent check (it is the request for consent) and the merchant cannot switch it off.
 */
export async function deliverNewsletterConfirm(
  ctx: StoreContext,
  input: { signupId: string },
  opts: DeliverOptions & { storefrontUrl: string },
  now: Date = new Date(),
): Promise<DeliveryResult[]> {
  const [signup] = await ctx.tx
    .select()
    .from(newsletterSignup)
    .where(eq(newsletterSignup.id, input.signupId))
  if (signup?.status !== 'pending' || signup.expiresAt.getTime() <= now.getTime()) return []
  const [s] = await ctx.tx.select({ name: store.name }).from(store).where(eq(store.id, ctx.storeId))
  // The confirm page checks the store its hostname resolves to, so the link goes to the
  // store's own primary domain (the platform storefront URL in development).
  const base = await storefrontOriginFor(ctx.tx, ctx.storeId, opts.storefrontUrl)
  const token = newsletterConfirmToken(signup, opts.settingsSecret)
  const data: TemplateData = {
    storeName: s?.name ?? '',
    customerName: '',
    totalLabel: '',
    lines: [],
    paymentMethodLabel: '',
    actionUrl: newsletterConfirmUrl(base, token),
  }
  const template: TemplateId = 'newsletter_confirm'
  const results: DeliveryResult[] = []
  for (const channel of await channelsFor(ctx, opts)) {
    if (channel.requires !== 'email') continue
    const r = await channel.send({ to: { email: signup.email }, template, data })
    await ctx.tx.insert(notification).values({
      storeId: ctx.storeId,
      channel: channel.id,
      template,
      to: signup.email,
      status: r.ok ? 'sent' : 'failed',
      providerRef: r.ok ? r.providerRef : null,
      error: r.ok ? null : r.error,
    })
    results.push({
      channel: channel.id,
      to: signup.email,
      ok: r.ok,
      error: r.ok ? undefined : r.error,
    })
  }
  return results
}

/**
 * Everything a recovery message needs, from the cart rather than an order.
 * Null when the cart is gone or empty.
 */
export async function buildCartTemplateData(
  ctx: StoreContext,
  cartId: string,
  actionUrl?: string,
): Promise<{ data: TemplateData; to: Recipient } | null> {
  const [c] = await ctx.tx.select().from(cart).where(eq(cart.id, cartId))
  if (!c) return null
  const [s] = await ctx.tx.select({ name: store.name }).from(store).where(eq(store.id, ctx.storeId))
  const lines = await ctx.tx
    .select({
      quantity: cartLine.quantity,
      unitPricePaise: cartLine.unitPricePaise,
      productTitle: product.title,
      variantTitle: variant.title,
    })
    .from(cartLine)
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(eq(cartLine.cartId, cartId))
  if (lines.length === 0) return null
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)
  return {
    data: {
      storeName: s?.name ?? '',
      customerName: c.customerName || 'there',
      totalLabel: formatMoney(subtotal),
      lines: lines.map((l) => ({
        title: [l.productTitle, l.variantTitle !== 'Default' ? l.variantTitle : null]
          .filter(Boolean)
          .join(' / '),
        quantity: l.quantity,
        priceLabel: formatMoney(l.quantity * l.unitPricePaise),
      })),
      paymentMethodLabel: '',
      actionUrl,
    },
    to: { email: c.email ?? undefined, phone: c.phone ?? undefined },
  }
}

/** Why a manual recovery skipped a channel: a known customer there has not consented. */
export const RECOVERY_NO_CONSENT = 'no_consent'

/**
 * Whether the manual recovery may use this address. The customers the store
 * knows for it (the basket's signed-in customer, and whoever owns that email
 * or phone) must all have said yes on the channel; a guest nobody knows may
 * get the one nudge. Phone channels are held to WhatsApp consent, as in
 * `marketing/send.ts`. See `mayNudgeKnownContact`.
 */
async function recoveryConsented(
  ctx: StoreContext,
  cartId: string,
  requires: 'email' | 'phone',
  to: string,
  secret: string,
): Promise<boolean> {
  const [c] = await ctx.tx
    .select({ customerId: cart.customerId })
    .from(cart)
    .where(eq(cart.id, cartId))
  const variants = requires === 'phone' ? phoneLookupVariants(to) : []
  const owns =
    requires === 'email'
      ? eq(customer.email, to.trim().toLowerCase())
      : variants.length > 0
        ? or(
            inArray(
              customer.phoneIndex,
              variants.map((v) => phoneBlindIndex(v, secret)),
            ),
            inArray(customer.phone, variants),
          )
        : undefined
  const who = [c?.customerId ? eq(customer.id, c.customerId) : undefined, owns].filter(
    (x) => x !== undefined,
  )
  if (who.length === 0) return true
  const known = await ctx.tx
    .select({
      acceptsMarketing: customer.acceptsMarketing,
      acceptsWhatsapp: customer.acceptsWhatsapp,
      acceptsSms: customer.acceptsSms,
      unsubscribedAt: customer.unsubscribedAt,
      anonymisedAt: customer.anonymisedAt,
    })
    .from(customer)
    .where(or(...who))
  return mayNudgeKnownContact(known, requires === 'email' ? 'email' : 'whatsapp')
}

/**
 * Ask a shopper to come back to an abandoned basket. Recorded against the
 * cart, so the same basket is never nudged twice by two code paths.
 */
export async function deliverCartRecovery(
  ctx: StoreContext,
  input: { cartId: string; actionUrl?: string | undefined; custom?: CustomMessage | undefined },
  opts: DeliverOptions,
): Promise<DeliveryResult[]> {
  const built = await buildCartTemplateData(ctx, input.cartId, input.actionUrl)
  if (!built) return []
  // The merchant's own subject and note from the "Review email" dialog.
  const data = input.custom ? { ...built.data, custom: input.custom } : built.data
  const template: TemplateId = 'checkout_recovery'
  const channels = await channelsFor(ctx, opts)
  const already = await ctx.tx
    .select({ channel: notification.channel, status: notification.status })
    .from(notification)
    .where(and(eq(notification.cartId, input.cartId), eq(notification.template, template)))
  const sent = new Set(already.filter((n) => n.status === 'sent').map((n) => n.channel))

  const results: DeliveryResult[] = []
  for (const channel of channels) {
    const to = built.to[channel.requires]
    if (!to || sent.has(channel.id)) continue
    if (!(await recoveryConsented(ctx, input.cartId, channel.requires, to, opts.settingsSecret))) {
      results.push({ channel: channel.id, to, ok: false, error: RECOVERY_NO_CONSENT })
      continue
    }
    const r = await channel.send({ to: built.to, template, data })
    await ctx.tx
      .insert(notification)
      .values({
        storeId: ctx.storeId,
        cartId: input.cartId,
        channel: channel.id,
        template,
        to,
        status: r.ok ? 'sent' : 'failed',
        providerRef: r.ok ? r.providerRef : null,
        error: r.ok ? null : r.error,
      })
      .onConflictDoUpdate({
        target: [notification.cartId, notification.channel, notification.template],
        targetWhere: sql`cart_id is not null`,
        set: {
          status: r.ok ? 'sent' : 'failed',
          providerRef: r.ok ? r.providerRef : null,
          error: r.ok ? null : r.error,
        },
      })
    results.push({ channel: channel.id, to, ok: r.ok, error: r.ok ? undefined : r.error })
  }
  return results
}

/** Paid outside a gateway: never a "your payment did not go through" order. */
const OFFLINE_METHODS: ReadonlySet<string> = new Set(['cod', 'manual', ...SPLIT_TENDER_PROVIDERS])

/**
 * Whether an order is still a "Payment pending" order (#1001 rules: a storefront checkout whose
 * online payment never finished) that the shopper can still pay: open, unpaid, not imported.
 * A cancelled one (the unpaid expiry ran) cannot be retried, so it is not nudged.
 */
async function stillPaymentPending(ctx: StoreContext, orderId: string): Promise<boolean> {
  const [o] = await ctx.tx
    .select({
      status: order.status,
      checkoutPaidAt: order.checkoutPaidAt,
      cartId: order.cartId,
      importedFrom: order.importedFrom,
      paymentMethod: order.paymentMethod,
      draftSource: order.draftSource,
      draftExpiredAt: order.draftExpiredAt,
    })
    .from(order)
    .where(eq(order.id, orderId))
  // An unpaid checkout kept as a draft (#D57) waits for its payment the same way.
  const waiting = o?.status === 'open' || (o && isOpenCheckoutDraft(o))
  if (!o || !waiting || o.checkoutPaidAt || o.importedFrom || !o.cartId) return false
  return !OFFLINE_METHODS.has(o.paymentMethod ?? 'manual')
}

/** A typed courier name ("Blue Dart") reads well; a courier app id ("delhivery") does not. */
const courierName = (carrier: string | null, provider: string): string | undefined =>
  carrier?.trim() || (/^[a-z0-9_-]+$/.test(provider) ? undefined : provider)

/**
 * The new tracking details for shipping_update, from the shipment that changed. Null when it
 * is gone or cancelled, or when the shopper never got the shipped message (nothing to correct).
 */
async function trackingUpdateData(
  ctx: StoreContext,
  orderId: string,
  shipmentId: string | undefined,
): Promise<Partial<TemplateData> | null> {
  if (!shipmentId) return null
  const [row] = await ctx.tx
    .select({
      waybill: shipment.waybill,
      trackingUrl: shipment.trackingUrl,
      carrier: shipment.carrier,
      provider: shipment.provider,
      status: shipment.status,
    })
    .from(shipment)
    .where(and(eq(shipment.id, shipmentId), eq(shipment.orderId, orderId)))
  if (!row || row.status === 'cancelled') return null
  const [told] = await ctx.tx
    .select({ id: notification.id })
    .from(notification)
    .where(
      and(
        eq(notification.orderId, orderId),
        eq(notification.template, 'order_shipped'),
        eq(notification.status, 'sent'),
      ),
    )
    .limit(1)
  if (!told) return null
  return {
    waybill: row.waybill,
    trackingUrl: row.trackingUrl ?? undefined,
    courierLabel: courierName(row.carrier, row.provider),
  }
}

/**
 * Send one template for one order through every enabled channel and record
 * the outcome. A channel that already sent this template is skipped, so a
 * retried job only re-attempts the failures.
 */
export async function deliverNotification(
  ctx: StoreContext,
  input: {
    orderId: string
    template: TemplateId
    returnId?: string | undefined
    refundId?: string | undefined
    shipmentId?: string | undefined
  },
  opts: DeliverOptions,
): Promise<DeliveryResult[]> {
  // Order and balance links open on the store's own domain; `opts.storefrontUrl` (the
  // platform URL) is only the fallback for a store without a live primary domain.
  const storefrontUrl = opts.storefrontUrl
    ? await storefrontOriginFor(ctx.tx, ctx.storeId, opts.storefrontUrl)
    : undefined
  const built = await buildTemplateData(ctx, input.orderId, storefrontUrl, opts.settingsSecret)
  if (!built) return []
  // The merchant switched this message off in Settings → Notifications.
  if (!(await messageOn(ctx, input.template))) return []
  let actionUrl: string | undefined
  if (BALANCE_ASKS.has(input.template)) {
    const [o] = await ctx.tx.select().from(order).where(eq(order.id, input.orderId))
    if (!o || balanceOwed(o) <= 0) return []
    if (storefrontUrl) actionUrl = balanceUrl(o.id, opts.settingsSecret, storefrontUrl)
  }
  // A draft invoice's "Pay securely" button: the signed page where the customer pays it online.
  if (input.template === 'draft_invoice' && storefrontUrl) {
    actionUrl = invoiceUrl(input.orderId, opts.settingsSecret, storefrontUrl)
  }
  // A reminder to pay is pointless once the order is paid or gone.
  if (input.template === 'payment_reminder') {
    const [o] = await ctx.tx
      .select({ status: order.status, checkoutPaidAt: order.checkoutPaidAt })
      .from(order)
      .where(eq(order.id, input.orderId))
    if (o?.status !== 'open' || o.checkoutPaidAt) return []
  }
  // "Complete your transfer": only while the transfer checkout still waits as a draft.
  if (input.template === 'transfer_requested') {
    const [o] = await ctx.tx
      .select({
        status: order.status,
        draftSource: order.draftSource,
        draftExpiredAt: order.draftExpiredAt,
      })
      .from(order)
      .where(eq(order.id, input.orderId))
    if (!o || !isOpenCheckoutDraft(o)) return []
  }
  // "Your payment did not go through": only while the order still waits on an online payment.
  if (input.template === 'payment_pending' && !(await stillPaymentPending(ctx, input.orderId))) {
    return []
  }
  // An edit message for an order cancelled meanwhile would only confuse.
  if (input.template === 'order_edited') {
    const [o] = await ctx.tx
      .select({ status: order.status })
      .from(order)
      .where(eq(order.id, input.orderId))
    if (o?.status !== 'open') return []
  }
  // shipping_update carries the changed shipment's details, not the order's first booking.
  const tracking =
    input.template === 'shipping_update'
      ? await trackingUpdateData(ctx, input.orderId, input.shipmentId)
      : null
  if (input.template === 'shipping_update' && !tracking) return []
  // A return message lists the items going back, not the whole order.
  const returned = input.returnId ? await returnTemplateData(ctx, input.returnId) : null
  if (input.template.startsWith('return_') && !returned) return []
  // refund_issued reports one specific refund's amount and method.
  const refunded = input.refundId ? await refundTemplateData(ctx, input.refundId) : null
  if (input.template === 'refund_issued' && !refunded) return []
  // Store credit only where it moved or paid part (owner, 12 Nov 2026): see storeCreditTemplateData.
  const credit = await storeCreditTemplateData(ctx, input)
  const merchant = MERCHANT_TEMPLATES.has(input.template)
    ? await merchantNotice(ctx, input.orderId)
    : null
  if (MERCHANT_TEMPLATES.has(input.template) && !merchant) return []
  const recipient = merchant?.to ?? built.to
  // The COD & RTO app's confirm link goes by WhatsApp when the store has it, else email.
  const cod = { channels: await channelsFor(ctx, opts), to: recipient, storefrontUrl }
  const routed = await codConfirmDelivery(ctx, input, { ...cod, secret: opts.settingsSecret })
  if (!routed) return []
  actionUrl = routed.actionUrl ?? actionUrl
  const channels = routed.channels
  const extras = opts.extras ? await opts.extras(input) : null
  // The exchange message is about the new order: its own items, only the return's label.
  const returnData =
    input.template === 'return_exchanged' ? { returnInfo: returned?.returnInfo } : returned
  const already = await ctx.tx
    .select({ channel: notification.channel, status: notification.status })
    .from(notification)
    .where(and(eq(notification.orderId, input.orderId), eq(notification.template, input.template)))
  // A draft invoice sent again is a reminder, and says so.
  const reminder = input.template === 'draft_invoice' && already.some((n) => n.status === 'sent')
  const data = {
    ...built.data,
    ...(actionUrl ? { actionUrl } : {}),
    ...returnData,
    ...refunded,
    ...credit,
    ...tracking,
    ...merchant?.data,
    ...(reminder ? { reminder: true } : {}),
    ...opts.data,
    ...(extras?.links.length ? { links: extras.links } : {}),
  }
  const attachments = extras?.attachments.length ? extras.attachments : undefined

  const sent = new Set(
    opts.resend ? [] : already.filter((n) => n.status === 'sent').map((n) => n.channel),
  )

  const results: DeliveryResult[] = []
  for (const channel of channels) {
    if (opts.requires && channel.requires !== opts.requires) continue
    // Merchant messages go by email only; there is no approved WhatsApp template for them.
    if (merchant && channel.requires !== 'email') continue
    const to = recipient[channel.requires]
    if (!to || sent.has(channel.id)) continue
    const r = await channel.send({ to: recipient, template: input.template, data, attachments })
    await ctx.tx
      .insert(notification)
      .values({
        storeId: ctx.storeId,
        orderId: input.orderId,
        channel: channel.id,
        template: input.template,
        to,
        status: r.ok ? 'sent' : 'failed',
        providerRef: r.ok ? r.providerRef : null,
        error: r.ok ? null : r.error,
      })
      .onConflictDoUpdate({
        target: [notification.orderId, notification.channel, notification.template],
        set: {
          status: r.ok ? 'sent' : 'failed',
          providerRef: r.ok ? r.providerRef : null,
          error: r.ok ? null : r.error,
        },
      })
    results.push({ channel: channel.id, to, ok: r.ok, error: r.ok ? undefined : r.error })
  }
  return results
}
