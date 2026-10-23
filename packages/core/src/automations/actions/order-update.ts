/** SOURCE OF TRUTH: "Send order update" automation action — WHAT: tells the shopper about their own order without marketing consent, but only with an order email template (sent through `deliverNotification`, once per template per order) or a WhatsApp template the provider lists as an approved UTILITY one, only to the order's own contact, only on order subjects / WHY: owner answer Q4: the consent-free half of customer messaging must never carry marketing. Server-only. Design §8.4. */
import { order, type StoreTx } from '@commerce/db'
import type { ChannelTemplate, NotificationChannel, TemplateId } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { normalisePhone } from '../../marketing/audience'
import { marketingChannels, sendMarketingWhatsapp } from '../../marketing/send'
import type { WhatsappTemplateRef } from '../../marketing/whatsapp'
import { deliverNotification } from '../../notifications/deliver'
import { messageDef } from '../../notifications/messages'
import { type ActionContext, type ActionExecutor, AutomationActionError } from '../executor'
import { fill, mergeValues, notConnected, skipped } from './messages'
import { type BuiltinActionDeps, claimMessage, gone, sendFailure, subjectId } from './shared'

// ---------------------------------------------------------------------------------------------
// Send order update (no consent: order email templates, utility WhatsApp templates)
// ---------------------------------------------------------------------------------------------

type OrderUpdateConfig =
  | { channel: 'email'; template: string }
  | { channel: 'whatsapp'; template: WhatsappTemplateRef }

/** Order emails that need nothing but the order (refunds and returns need their own record). */
const ORDER_UPDATE_TEMPLATES: ReadonlySet<string> = new Set([
  'order_placed',
  'payment_received',
  'order_shipped',
  'out_for_delivery',
  'delivered',
  'delivery_failed',
  'order_cancelled',
])

export const isOrderUpdateTemplate = (id: string): boolean =>
  ORDER_UPDATE_TEMPLATES.has(id) && messageDef(id)?.group === 'orders'

/** The approved UTILITY template on the channel, or why it may not be used. */
async function utilityTemplate(
  channel: NotificationChannel,
  ref: WhatsappTemplateRef,
): Promise<{ ok: true; template: ChannelTemplate } | { ok: false; reason: string }> {
  if (!channel.listTemplates)
    return { ok: false, reason: 'This WhatsApp channel cannot list its templates' }
  let list: ChannelTemplate[]
  try {
    list = await channel.listTemplates()
  } catch (err) {
    throw new AutomationActionError('Could not read the WhatsApp templates', {
      retryable: true,
      cause: err,
    })
  }
  const t = list.find((x) => x.name === ref.name && x.language === ref.language)
  if (!t) return { ok: false, reason: `WhatsApp template ${ref.name} (${ref.language}) not found` }
  if (t.category.toUpperCase() !== 'UTILITY') {
    return {
      ok: false,
      reason: `${ref.name} is a ${t.category.toLowerCase()} template, not a utility one`,
    }
  }
  if (t.status.toUpperCase() !== 'APPROVED')
    return { ok: false, reason: `${ref.name} is not approved yet` }
  return { ok: true, template: t }
}

export function orderUpdate(deps: BuiltinActionDeps): ActionExecutor<OrderUpdateConfig> {
  const orderOf = async (tx: StoreTx, ctx: ActionContext) => {
    const [o] = await tx
      .select()
      .from(order)
      .where(eq(order.id, subjectId(ctx, 'an order')))
    if (!o) throw gone('order')
    return o
  }
  return {
    id: 'customer.send_order_update',
    async run({ tx, ctx, config }) {
      const o = await orderOf(tx, ctx)
      if (config.channel === 'email') {
        if (!isOrderUpdateTemplate(config.template)) {
          throw new AutomationActionError(`${config.template} is not an order message`, {
            retryable: false,
          })
        }
        if (!o.email) return skipped('The order has no email', 'no_recipient')
        const results = await deliverNotification(
          { storeId: ctx.storeId, tx },
          { orderId: o.id, template: config.template as TemplateId },
          {
            registry: deps.registry,
            settingsSecret: deps.settingsSecret,
            storefrontUrl: deps.storefrontUrl,
            requires: 'email',
            channels: deps.channels,
          },
        )
        // Nothing sent: already sent for this order (once per template), or switched off.
        if (results.length === 0) {
          return {
            noop: true,
            summary: 'Already sent, or switched off in Settings → Notifications',
          }
        }
        const failed = results.find((r) => !r.ok)
        if (failed && !results.some((r) => r.ok)) throw sendFailure(failed.error ?? 'failed', true)
        return { summary: `Emailed ${o.email}`, output: { to: o.email, template: config.template } }
      }
      // The order's own phone: an update about the shopper's own order needs no consent.
      const phone = normalisePhone(o.phone)
      if (!phone) return skipped('The order has no phone', 'no_recipient')
      const { whatsapp } = await marketingChannels(tx, ctx.storeId, deps)
      if (!whatsapp) throw notConnected('WhatsApp')
      const checked = await utilityTemplate(whatsapp, config.template)
      if (!checked.ok) throw new AutomationActionError(checked.reason, { retryable: false })
      const msg = await claimMessage(tx, ctx, {
        channel: 'whatsapp',
        to: phone,
        customerId: o.customerId,
      })
      if (msg.alreadySent) return { noop: true, summary: 'Already sent' }
      const merge = await mergeValues(tx, ctx, deps, null)
      const r = await sendMarketingWhatsapp(
        tx,
        whatsapp,
        {
          messageId: msg.id,
          to: phone,
          customerId: o.customerId,
          transactional: true,
          template: config.template,
          merge,
        },
        (s, m) => fill(ctx, s, m),
      )
      if (!r.ok) throw sendFailure(r.error, r.retryable)
      return { summary: `Sent ${config.template.name} on WhatsApp`, output: { to: phone } }
    },
    async preview({ tx, ctx, config }) {
      const o = await orderOf(tx, ctx)
      if (config.channel === 'email') {
        if (!isOrderUpdateTemplate(config.template)) {
          return { summary: `${config.template} is not an order message`, wouldRun: false }
        }
        return o.email
          ? { summary: `Would email ${o.email} the ${config.template} message`, wouldRun: true }
          : { summary: 'The order has no email', wouldRun: false }
      }
      if (!normalisePhone(o.phone)) return { summary: 'The order has no phone', wouldRun: false }
      const { whatsapp } = await marketingChannels(tx, ctx.storeId, deps)
      if (!whatsapp) return { summary: 'WhatsApp is not connected', wouldRun: false }
      const checked = await utilityTemplate(whatsapp, config.template).catch(() => null)
      if (checked && !checked.ok) return { summary: checked.reason, wouldRun: false }
      return {
        summary: `Would send ${config.template.name} on WhatsApp to the order's phone`,
        wouldRun: true,
        warnings: checked ? undefined : ['Could not check the template right now'],
      }
    },
  }
}
