import { customer, notification, order, orderLine, store } from '@commerce/db'
import type {
  NotificationChannel,
  NotificationRegistry,
  Recipient,
  TemplateData,
  TemplateId,
} from '@commerce/notifications'
import { and, eq } from 'drizzle-orm'
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
    },
    to: { email: o.email ?? undefined, phone: o.phone ?? undefined },
  }
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

  let channels = opts.channels
  if (!channels) {
    const [s] = await ctx.tx
      .select({ notifications: store.notifications })
      .from(store)
      .where(eq(store.id, ctx.storeId))
    channels = resolveNotificationChannels(
      opts.registry,
      parseNotificationSettings(s?.notifications),
      opts.settingsSecret,
    ).channels
  }

  const already = await ctx.tx
    .select({ channel: notification.channel, status: notification.status })
    .from(notification)
    .where(and(eq(notification.orderId, input.orderId), eq(notification.template, input.template)))
  const sent = new Set(already.filter((n) => n.status === 'sent').map((n) => n.channel))

  const results: DeliveryResult[] = []
  for (const channel of channels) {
    const to = built.to[channel.requires]
    if (!to || sent.has(channel.id)) continue
    const r = await channel.send({ to: built.to, template: input.template, data: built.data })
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
