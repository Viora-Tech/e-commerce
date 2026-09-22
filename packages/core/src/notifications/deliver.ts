import {
  cart,
  cartLine,
  customer,
  notification,
  order,
  orderLine,
  product,
  shipment,
  store,
  variant,
} from '@commerce/db'
import type {
  Attachment,
  NotificationChannel,
  NotificationRegistry,
  Recipient,
  TemplateData,
  TemplateId,
} from '@commerce/notifications'
import { and, eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { parseNotificationSettings, resolveNotificationChannels } from './settings'

export type DeliveryResult = {
  channel: string
  to: string
  ok: boolean
  error?: string | undefined
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

/** Human label for the order's payment_method id; adapters own the real label, this is the fallback. */
const PAYMENT_LABELS: Record<string, string> = {
  cod: 'Cash on delivery',
  manual: 'UPI or bank transfer',
  razorpay: 'Razorpay',
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

/** Load everything a template needs from the order. Null when the order is not visible. */
export async function buildTemplateData(
  ctx: StoreContext,
  orderId: string,
  storefrontUrl?: string,
): Promise<{ data: TemplateData; to: Recipient } | null> {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId))
  if (!o) return null
  const [s] = await ctx.tx.select({ name: store.name }).from(store).where(eq(store.id, ctx.storeId))
  const lines = await ctx.tx.select().from(orderLine).where(eq(orderLine.orderId, orderId))
  const [cu] = o.customerId
    ? await ctx.tx.select().from(customer).where(eq(customer.id, o.customerId))
    : []
  const [ship] = await ctx.tx
    .select({ waybill: shipment.waybill, trackingUrl: shipment.trackingUrl })
    .from(shipment)
    .where(eq(shipment.orderId, orderId))
  const method = o.paymentMethod ?? ''
  return {
    data: {
      storeName: s?.name ?? '',
      orderNumber: o.number,
      customerName: cu?.name || 'there',
      totalLabel: inr.format(o.totalPaise / 100),
      lines: lines.map((l) => ({
        title: [l.title, l.variantTitle !== 'Default' ? l.variantTitle : null]
          .filter(Boolean)
          .join(' / '),
        quantity: l.quantity,
        priceLabel: inr.format((l.quantity * l.unitPricePaise) / 100),
      })),
      paymentMethodLabel: PAYMENT_LABELS[method] ?? method,
      orderUrl: storefrontUrl ? `${storefrontUrl}/checkout/thank-you/${o.number}` : undefined,
      waybill: ship?.waybill ?? undefined,
      trackingUrl: ship?.trackingUrl ?? undefined,
    },
    to: { email: o.email ?? undefined, phone: o.phone ?? undefined },
  }
}

/** The store's enabled channels, unless the caller injected fakes. */
async function channelsFor(ctx: StoreContext, opts: DeliverOptions) {
  if (opts.channels) return opts.channels
  const [s] = await ctx.tx
    .select({ notifications: store.notifications })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  return resolveNotificationChannels(
    opts.registry,
    parseNotificationSettings(s?.notifications),
    opts.settingsSecret,
  ).channels
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
      totalLabel: inr.format(subtotal / 100),
      lines: lines.map((l) => ({
        title: [l.productTitle, l.variantTitle !== 'Default' ? l.variantTitle : null]
          .filter(Boolean)
          .join(' / '),
        quantity: l.quantity,
        priceLabel: inr.format((l.quantity * l.unitPricePaise) / 100),
      })),
      paymentMethodLabel: '',
      actionUrl,
    },
    to: { email: c.email ?? undefined, phone: c.phone ?? undefined },
  }
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
  input: { orderId: string; template: TemplateId },
  opts: DeliverOptions,
): Promise<DeliveryResult[]> {
  const built = await buildTemplateData(ctx, input.orderId, opts.storefrontUrl)
  if (!built) return []

  const channels = await channelsFor(ctx, opts)
  const extras = opts.extras ? await opts.extras(input) : null
  const data = {
    ...built.data,
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
    const to = built.to[channel.requires]
    if (!to || sent.has(channel.id)) continue
    const r = await channel.send({ to: built.to, template: input.template, data, attachments })
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
