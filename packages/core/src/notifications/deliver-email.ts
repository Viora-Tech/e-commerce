/** SOURCE OF TRUTH: one-off emails outside an order's own messages — WHAT: one email to one address through the store's email channels (the store's contact address for a form message, a shopper for a review request or a reply), logged like every notification and skipped when the merchant switched the message off / WHY: apps build these messages from their own data, so they need a delivery path that does not start from an order */
import { notification, store } from '@commerce/db'
import type { TemplateData, TemplateId } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { channelsFor, type DeliverOptions, type DeliveryResult, messageOn } from './deliver'

/**
 * A message to the MERCHANT that belongs to no order (a form message from the Forms app):
 * one email to the store's contact address through the email channels. Nothing goes out
 * when the store has no contact address or the merchant switched the message off.
 */
export async function deliverToStoreContact(
  ctx: StoreContext,
  template: TemplateId,
  data: Partial<TemplateData>,
  opts: DeliverOptions,
): Promise<DeliveryResult[]> {
  const [s] = await ctx.tx
    .select({ email: store.contactEmail })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  if (!s?.email) return []
  return deliverEmailTo(ctx, template, s.email, data, opts)
}

/**
 * One email to one address through the store's email channels, for a message an app
 * builds itself (a review request, a reply to a review): the store's name is filled in,
 * every send is logged, and nothing goes out when the merchant switched the message off.
 */
export async function deliverEmailTo(
  ctx: StoreContext,
  template: TemplateId,
  to: string,
  data: Partial<TemplateData>,
  opts: DeliverOptions,
): Promise<DeliveryResult[]> {
  return deliverMessageTo(ctx, template, { email: to }, data, opts)
}

/**
 * The same for a person with an email, a phone or both (an affiliate): each enabled channel
 * that can reach them sends once (email channels to the address, WhatsApp to the phone, as an
 * approved template named after the message). Logged and skippable like `deliverEmailTo`.
 */
export async function deliverMessageTo(
  ctx: StoreContext,
  template: TemplateId,
  to: { email?: string | null | undefined; phone?: string | null | undefined },
  data: Partial<TemplateData>,
  opts: DeliverOptions,
): Promise<DeliveryResult[]> {
  const [s] = await ctx.tx.select({ name: store.name }).from(store).where(eq(store.id, ctx.storeId))
  if ((!to.email && !to.phone) || !(await messageOn(ctx, template))) return []
  const full: TemplateData = {
    customerName: '',
    totalLabel: '',
    lines: [],
    paymentMethodLabel: '',
    ...data,
    storeName: s?.name ?? '',
  }
  const results: DeliveryResult[] = []
  for (const channel of await channelsFor(ctx, opts)) {
    const address = channel.requires === 'email' ? to.email : to.phone
    if (!address) continue
    const r = await channel.send({
      to: channel.requires === 'email' ? { email: address } : { phone: address },
      template,
      data: full,
    })
    await ctx.tx.insert(notification).values({
      storeId: ctx.storeId,
      channel: channel.id,
      template,
      to: address,
      status: r.ok ? 'sent' : 'failed',
      providerRef: r.ok ? r.providerRef : null,
      error: r.ok ? null : r.error,
    })
    results.push({ channel: channel.id, to: address, ok: r.ok, error: r.ok ? undefined : r.error })
  }
  return results
}
