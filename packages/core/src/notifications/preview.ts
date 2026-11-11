/** SOURCE OF TRUTH: hand-sent order message previews — WHAT: renders a draft invoice, balance request, payment reminder or order link exactly as delivery would, without sending / WHY: the "Review email" dialog must show what the customer will get */
import { notification, order } from '@commerce/db'
import {
  type CustomMessage,
  renderEmail,
  renderWhatsapp,
  type TemplateId,
} from '@commerce/notifications'
import { and, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { storefrontOriginFor } from '../domains/origin'
import { balanceOwed } from '../preorder/balance'
import { balanceUrl, invoiceUrl } from '../preorder/balance-link'
import { buildCartTemplateData, buildTemplateData, messageOn } from './deliver'
import { storeEmailBrand } from './email-brand'
import { messageDef } from './messages'
import { storeCreditTemplateData } from './store-credit-data'

/** The messages an admin sends by hand from an order, previewed before they go. */
export const ORDER_PREVIEW_TEMPLATES = [
  'draft_invoice',
  'balance_request',
  'payment_reminder',
  'order_link',
] as const satisfies readonly TemplateId[]
export type OrderPreviewTemplate = (typeof ORDER_PREVIEW_TEMPLATES)[number]

/**
 * One order's message exactly as `deliverNotification` would fill it (same data, same links),
 * rendered but not sent: for the "Review email" dialog before a send. Null when the order is gone.
 */
export async function previewOrderMessage(
  ctx: StoreContext,
  input: { orderId: string; template: OrderPreviewTemplate; custom?: CustomMessage | undefined },
  /** `whatsapp`: the store has a WhatsApp channel, so the WhatsApp text is shown too. */
  opts: { storefrontUrl: string; settingsSecret: string; whatsapp: boolean },
) {
  const origin = await storefrontOriginFor(ctx.tx, ctx.storeId, opts.storefrontUrl)
  const built = await buildTemplateData(ctx, input.orderId, origin, opts.settingsSecret)
  if (!built) return null
  let actionUrl: string | undefined
  if (input.template === 'balance_request') {
    const [o] = await ctx.tx.select().from(order).where(eq(order.id, input.orderId))
    if (o && balanceOwed(o) > 0) actionUrl = balanceUrl(o.id, opts.settingsSecret, origin)
  }
  let reminder = false
  if (input.template === 'draft_invoice') {
    actionUrl = invoiceUrl(input.orderId, opts.settingsSecret, origin)
    // Sent before: the next one goes out as a reminder (see `deliverNotification`).
    const [sent] = await ctx.tx
      .select({ id: notification.id })
      .from(notification)
      .where(
        and(
          eq(notification.orderId, input.orderId),
          eq(notification.template, 'draft_invoice'),
          eq(notification.status, 'sent'),
        ),
      )
      .limit(1)
    reminder = Boolean(sent)
  }
  // A draft invoice paid partly by store credit shows it, as the sent one does.
  const credit = await storeCreditTemplateData(ctx, input)
  const data = {
    ...built.data,
    ...credit,
    brand: await storeEmailBrand(ctx.tx, ctx.storeId),
    ...(actionUrl ? { actionUrl } : {}),
    ...(reminder ? { reminder: true } : {}),
    ...(input.custom ? { custom: input.custom } : {}),
  }
  const email = await renderEmail(input.template, data)
  // The template's own subject, so the dialog can prefill it and tell an edit apart.
  const defaultSubject = input.custom?.subject
    ? (
        await renderEmail(input.template, {
          ...built.data,
          ...credit,
          ...(reminder ? { reminder } : {}),
        })
      )
        .subject
    : email.subject
  const chat = messageDef(input.template)?.channels.includes('whatsapp')
    ? renderWhatsapp(input.template, data).text
    : null
  return {
    to: built.to,
    subject: email.subject,
    defaultSubject,
    html: email.html,
    whatsapp: opts.whatsapp ? chat : null,
    /**
     * The same WhatsApp text for "Open in WhatsApp": the merchant's own wa.me chat, sent by hand.
     * Always there (WhatsApp connected or not), so click to chat never depends on the channel.
     */
    chatText: chat,
    /** Off in Settings → Notifications: sending does nothing, so the dialog says so. */
    on: await messageOn(ctx, input.template),
  }
}

/**
 * An abandoned checkout's reminder exactly as `deliverCartRecovery` would fill it (same cart,
 * same recovery link), rendered but not sent: for the "Review email" dialog. Null when the cart is gone.
 */
export async function previewCartRecovery(
  ctx: StoreContext,
  input: { cartId: string; custom?: CustomMessage | undefined },
  /** `actionUrl`: the signed recovery link; `whatsapp`: the store has a WhatsApp channel. */
  opts: { actionUrl: string; whatsapp: boolean },
) {
  const template = 'checkout_recovery' as const
  const built = await buildCartTemplateData(ctx, input.cartId, opts.actionUrl)
  if (!built) return null
  const brand = await storeEmailBrand(ctx.tx, ctx.storeId)
  const data = { ...built.data, brand, ...(input.custom ? { custom: input.custom } : {}) }
  const email = await renderEmail(template, data)
  const defaultSubject = input.custom?.subject
    ? (await renderEmail(template, built.data)).subject
    : email.subject
  return {
    to: built.to,
    subject: email.subject,
    defaultSubject,
    html: email.html,
    whatsapp: opts.whatsapp ? renderWhatsapp(template, data).text : null,
    // "Open in WhatsApp" with the reminder typed in, connected or not.
    chatText: renderWhatsapp(template, data).text,
    on: true,
  }
}
