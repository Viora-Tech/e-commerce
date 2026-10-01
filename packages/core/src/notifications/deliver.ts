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
  productMedia,
  refund,
  shipment,
  store,
  storeDomain,
  variant,
} from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type {
  Attachment,
  NotificationChannel,
  NotificationRegistry,
  Recipient,
  TemplateData,
  TemplateId,
} from '@commerce/notifications'
import { and, eq, inArray, or, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { newsletterConfirmToken, newsletterConfirmUrl } from '../customers/newsletter'
import { phoneBlindIndex } from '../customers/phone-crypto'
import { GIFT_CARD_PROVIDER } from '../gift-cards/service'
import { mayNudgeKnownContact, phoneLookupVariants } from '../marketing/recipient'
import { manualCancelAt } from '../payments/manual-followup'
import { parsePaymentSettings } from '../payments/settings'
import { balanceOwed } from '../preorder/balance'
import { balanceUrl, thankYouUrl } from '../preorder/balance-link'
import {
  balancePayBy,
  depositIsNonRefundable,
  type PreorderStoreSettings,
  parsePreorderStoreSettings,
} from '../preorder/store-settings'
import { returnTemplateData } from '../returns/notify'
import { storeNotificationChannels } from '../sender-email/channels'
import type { GstBreakdown } from '../tax/gst'
import { isMessageOn } from './messages'
import { parseNotificationSettings } from './settings'

export type DeliveryResult = {
  channel: string
  to: string
  ok: boolean
  error?: string | undefined
}

const inr = (paise: number) => formatMoney(paise, 'INR')

/** Human label for the order's payment_method id; adapters own the real label, this is the fallback. */
const PAYMENT_LABELS: Record<string, string> = {
  cod: 'Cash on delivery',
  manual: 'UPI or bank transfer',
  razorpay: 'Razorpay',
  razorpay_upi: 'UPI',
}

export type DeliverOptions = {
  registry: NotificationRegistry
  settingsSecret: string
  /** Public storefront origin, for the "view your order" link. Optional. */
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

/** What a deposit pre-order still owes, for the balance messages; undefined on other orders. */
function balanceData(
  o: typeof order.$inferSelect,
  settings: PreorderStoreSettings,
): TemplateData['balance'] {
  if (o.depositPaise === null) return undefined
  const owed = balanceOwed(o)
  const payBy = balancePayBy(settings, o.balanceRequestedAt)
  return {
    dueLabel: inr(owed),
    depositLabel: inr(o.totalPaise - owed),
    payByLabel: payBy
      ? payBy.toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' })
      : undefined,
    depositNonRefundable: depositIsNonRefundable(settings),
  }
}

const isGst = (v: unknown): v is GstBreakdown =>
  typeof v === 'object' && v !== null && typeof (v as GstBreakdown).taxPaise === 'number'

/**
 * The GST split for the totals block, straight from what the order already stored at checkout
 * (see `computeOrderGst` in `order/place-order.ts`) - never recomputed, so it always matches the
 * order's own invoice. Omitted when the order carries no tax.
 */
function taxLines(o: typeof order.$inferSelect): TemplateData['taxBreakdown'] {
  const t = o.taxBreakdown
  if (!isGst(t) || t.taxPaise <= 0) return undefined
  const taxableLabel = inr(o.totalPaise - t.taxPaise)
  if (t.interState) {
    return [
      { label: 'Taxable value', amount: taxableLabel },
      { label: `IGST (${t.ratePercent}%)`, amount: inr(t.igstPaise) },
    ]
  }
  return [
    { label: 'Taxable value', amount: taxableLabel },
    { label: `CGST (${t.ratePercent / 2}%)`, amount: inr(t.cgstPaise) },
    { label: `SGST (${t.ratePercent / 2}%)`, amount: inr(t.sgstPaise) },
  ]
}

/** Human label for a refund's method, for the refund_issued message. */
function refundMethodLabel(provider: string): string {
  if (provider === GIFT_CARD_PROVIDER) return 'your gift card'
  return PAYMENT_LABELS[provider] ?? 'your original payment method'
}

/**
 * A gateway refund takes a few days to clear; a gift card or an offline method (COD, manual
 * transfer) the merchant settles directly does not have a bank-side wait to quote.
 */
function refundEtaLabel(provider: string): string | undefined {
  if (provider === GIFT_CARD_PROVIDER || provider === 'cod' || provider === 'manual') {
    return undefined
  }
  return '5 to 7 working days'
}

/** Everything the refund_issued message needs. Null when the refund row is gone. */
async function refundTemplateData(
  ctx: StoreContext,
  refundId: string,
): Promise<Partial<TemplateData> | null> {
  const [r] = await ctx.tx.select().from(refund).where(eq(refund.id, refundId))
  if (!r) return null
  const [p] = await ctx.tx.select().from(payment).where(eq(payment.id, r.paymentId))
  const provider = p?.provider ?? ''
  return {
    refund: {
      amountLabel: inr(r.amountPaise),
      methodLabel: refundMethodLabel(provider),
      etaLabel: refundEtaLabel(provider),
    },
  }
}

/** Messages asking for the balance: pointless (and confusing) once it is paid or the order is gone. */
const BALANCE_ASKS: ReadonlySet<TemplateId> = new Set(['balance_request', 'balance_reminder'])

/** Messages for the merchant, not the shopper: sent by email to the store's contact address. */
const MERCHANT_TEMPLATES: ReadonlySet<TemplateId> = new Set(['unpaid_cancel_notice'])

/**
 * Where a merchant message goes, and what it adds. Null when there is no
 * contact email, or the order no longer waits (paid or cancelled meanwhile).
 */
async function merchantNotice(
  ctx: StoreContext,
  orderId: string,
): Promise<{ to: Recipient; data: Partial<TemplateData> } | null> {
  const [s] = await ctx.tx
    .select({ email: store.contactEmail, payments: store.payments })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const [o] = await ctx.tx
    .select({
      status: order.status,
      checkoutPaidAt: order.checkoutPaidAt,
      placedAt: order.placedAt,
      noticeAt: order.unpaidCancelNoticeAt,
    })
    .from(order)
    .where(eq(order.id, orderId))
  if (!s?.email || o?.status !== 'open' || o.checkoutPaidAt) return null
  const at = manualCancelAt(parsePaymentSettings(s.payments).manualCancelAfterHours, {
    placedAt: o.placedAt,
    cancelNoticeAt: o.noticeAt,
  })
  return {
    to: { email: s.email },
    data: {
      deadlineLabel: at.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      }),
    },
  }
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
      productId: variant.productId,
      variantImage: media.url,
    })
    .from(orderLine)
    .leftJoin(variant, eq(variant.id, orderLine.variantId))
    .leftJoin(media, eq(media.id, variant.mediaId))
    .where(eq(orderLine.orderId, orderId))
  const productIds = [...new Set(lines.map((l) => l.productId).filter((id): id is string => !!id))]
  const images = productIds.length
    ? await ctx.tx
        .select({ productId: productMedia.productId, url: media.url })
        .from(productMedia)
        .innerJoin(media, eq(media.id, productMedia.mediaId))
        .where(and(inArray(productMedia.productId, productIds), eq(productMedia.position, 0)))
    : []
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
    .where(eq(shipment.orderId, orderId))
  const method = o.paymentMethod ?? ''
  return {
    data: {
      storeName: s?.name ?? '',
      orderNumber: o.number,
      customerName: cu?.name || 'there',
      totalLabel: inr(o.totalPaise),
      lines: lines.map((l) => ({
        title: [l.title, l.variantTitle !== 'Default' ? l.variantTitle : null]
          .filter(Boolean)
          .join(' / '),
        quantity: l.quantity,
        priceLabel: inr(l.quantity * l.unitPricePaise),
        imageUrl:
          l.variantImage ?? images.find((i) => i.productId === l.productId)?.url ?? undefined,
      })),
      taxBreakdown: taxLines(o),
      paymentMethodLabel: PAYMENT_LABELS[method] ?? method,
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
async function channelsFor(ctx: StoreContext, opts: DeliverOptions) {
  if (opts.channels) return opts.channels
  return storeNotificationChannels(ctx.tx, ctx.storeId, {
    registry: opts.registry,
    settingsSecret: opts.settingsSecret,
  })
}

/** Whether the store still sends this template (see `isMessageOn`). */
async function messageOn(ctx: StoreContext, template: TemplateId): Promise<boolean> {
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
  const [primary] = await ctx.tx
    .select({ hostname: storeDomain.hostname })
    .from(storeDomain)
    .where(and(eq(storeDomain.isPrimary, true), eq(storeDomain.status, 'active')))
  const dev = /(^|\.)localhost$/.test(new URL(opts.storefrontUrl).hostname)
  const base = primary && !dev ? `https://${primary.hostname}` : opts.storefrontUrl
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
      totalLabel: inr(subtotal),
      lines: lines.map((l) => ({
        title: [l.productTitle, l.variantTitle !== 'Default' ? l.variantTitle : null]
          .filter(Boolean)
          .join(' / '),
        quantity: l.quantity,
        priceLabel: inr(l.quantity * l.unitPricePaise),
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
  input: { cartId: string; actionUrl?: string | undefined },
  opts: DeliverOptions,
): Promise<DeliveryResult[]> {
  const built = await buildCartTemplateData(ctx, input.cartId, input.actionUrl)
  if (!built) return []
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
    const r = await channel.send({ to: built.to, template, data: built.data })
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
  },
  opts: DeliverOptions,
): Promise<DeliveryResult[]> {
  const built = await buildTemplateData(ctx, input.orderId, opts.storefrontUrl, opts.settingsSecret)
  if (!built) return []
  // The merchant switched this message off in Settings → Notifications.
  if (!(await messageOn(ctx, input.template))) return []
  let actionUrl: string | undefined
  if (BALANCE_ASKS.has(input.template)) {
    const [o] = await ctx.tx.select().from(order).where(eq(order.id, input.orderId))
    if (!o || balanceOwed(o) <= 0) return []
    if (opts.storefrontUrl) actionUrl = balanceUrl(o.id, opts.settingsSecret, opts.storefrontUrl)
  }
  // A reminder to pay is pointless once the order is paid or gone.
  if (input.template === 'payment_reminder') {
    const [o] = await ctx.tx
      .select({ status: order.status, checkoutPaidAt: order.checkoutPaidAt })
      .from(order)
      .where(eq(order.id, input.orderId))
    if (o?.status !== 'open' || o.checkoutPaidAt) return []
  }
  // A return message lists the items going back, not the whole order.
  const returned = input.returnId ? await returnTemplateData(ctx, input.returnId) : null
  if (input.template.startsWith('return_') && !returned) return []
  // refund_issued reports one specific refund's amount and method.
  const refunded = input.refundId ? await refundTemplateData(ctx, input.refundId) : null
  if (input.template === 'refund_issued' && !refunded) return []
  const merchant = MERCHANT_TEMPLATES.has(input.template)
    ? await merchantNotice(ctx, input.orderId)
    : null
  if (MERCHANT_TEMPLATES.has(input.template) && !merchant) return []
  const recipient = merchant?.to ?? built.to

  const channels = await channelsFor(ctx, opts)
  const extras = opts.extras ? await opts.extras(input) : null
  const data = {
    ...built.data,
    ...(actionUrl ? { actionUrl } : {}),
    ...returned,
    ...refunded,
    ...merchant?.data,
    ...opts.data,
    ...(extras?.links.length ? { links: extras.links } : {}),
  }
  const attachments = extras?.attachments.length ? extras.attachments : undefined

  const already = await ctx.tx
    .select({ channel: notification.channel, status: notification.status })
    .from(notification)
    .where(and(eq(notification.orderId, input.orderId), eq(notification.template, input.template)))
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
