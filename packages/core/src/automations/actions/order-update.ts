/** SOURCE OF TRUTH: "Send order update" automation action — WHAT: tells the shopper about their own order without marketing consent, but only with an order email template (sent through `deliverNotification`, once per template per order) or a WhatsApp template the provider lists as an approved UTILITY one, only to the order's own contact, only on order subjects / WHY: owner answer Q4: the consent-free half of customer messaging must never carry marketing. Server-only. Design §8.4. */
import { order, orderNote, outboxEvent, type StoreTx } from '@commerce/db'
import type { ChannelTemplate, NotificationChannel } from '@commerce/notifications'
import { and, eq, sql } from 'drizzle-orm'
import { normalisePhone } from '../../marketing/audience'
import { marketingChannels, prepareMarketingWhatsapp } from '../../marketing/send'
import type { WhatsappTemplateRef } from '../../marketing/whatsapp'
import { messageDef } from '../../notifications/messages'
import { insertOutboxEvent } from '../../outbox/write'
import { REMINDER_NOTE } from '../../payments/manual-followup'
import { storeNotificationChannels } from '../../sender-email/channels'
import { type ActionContext, type ActionExecutor, AutomationActionError } from '../executor'
import { fill, mergeValues, notConnected, skipped } from './messages'
import { messageExecutor, type Planned } from './outbound'
import { claimMessage, type DepsFor, gone, subjectId } from './shared'

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
  // A nudge to pay an unpaid transfer order: about the shopper's own order, no marketing.
  'payment_reminder',
])

export const isOrderUpdateTemplate = (id: string): boolean =>
  ORDER_UPDATE_TEMPLATES.has(id) &&
  (messageDef(id)?.group === 'orders' || id === 'payment_reminder')

/**
 * Whether the order message also goes on WhatsApp: the order has a phone and the store has a
 * WhatsApp channel, so delivery sends that channel's approved template of the same name (an
 * unpaid order's daily reminder reaches a shopper who left no email).
 */
async function alsoWhatsapp(
  tx: StoreTx,
  storeId: string,
  deps: Awaited<ReturnType<DepsFor>>,
  phone: string | null,
): Promise<boolean> {
  if (!normalisePhone(phone)) return false
  const channels =
    deps.channels ??
    (await storeNotificationChannels(tx, storeId, {
      registry: deps.registry,
      settingsSecret: deps.settingsSecret,
    }))
  return channels.some((c) => c.requires === 'phone')
}

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

export function orderUpdate(depsFor: DepsFor): ActionExecutor<OrderUpdateConfig> {
  const orderOf = async (tx: StoreTx, ctx: ActionContext) => {
    const [o] = await tx
      .select()
      .from(order)
      .where(eq(order.id, subjectId(ctx, 'an order')))
    if (!o) throw gone('order')
    return o
  }
  return messageExecutor<OrderUpdateConfig>(
    'customer.send_order_update',
    async ({ tx, ctx, config }): Promise<Planned> => {
      const deps = await depsFor(tx, ctx.storeId)
      const o = await orderOf(tx, ctx)
      if (config.channel === 'email') {
        if (!isOrderUpdateTemplate(config.template)) {
          throw new AutomationActionError(`${config.template} is not an order message`, {
            retryable: false,
          })
        }
        const whatsapp = await alsoWhatsapp(tx, ctx.storeId, deps, o.phone)
        if (!o.email && !whatsapp)
          return { kind: 'result', result: skipped('The order has no email', 'no_recipient') }
        // Once per template per order, however many runs ask (a daily reminder workflow finds
        // the same unpaid order again tomorrow).
        const [queued] = await tx
          .select({ id: outboxEvent.id })
          .from(outboxEvent)
          .where(
            and(
              eq(outboxEvent.type, 'automation.order_update'),
              sql`${outboxEvent.payload}->>'orderId' = ${o.id}`,
              sql`${outboxEvent.payload}->>'notificationTemplate' = ${config.template}`,
            ),
          )
          .limit(1)
        if (queued) {
          return {
            kind: 'result',
            result: { noop: true, summary: `The ${config.template} email was already sent` },
          }
        }
        // The order email goes out on the notification queue, like every order email: once
        // per template per order, after this step commits, with no transaction held.
        await insertOutboxEvent(tx, ctx.storeId, 'automation.order_update', {
          orderId: o.id,
          notificationTemplate: config.template,
        })
        const via = o.email ? (whatsapp ? 'both' : 'email') : 'whatsapp'
        // Each reminder shows on the order's timeline, like one the merchant sends by hand.
        if (config.template === 'payment_reminder') {
          await tx.insert(orderNote).values({
            storeId: ctx.storeId,
            orderId: o.id,
            body: REMINDER_NOTE(via, true),
            author: 'system',
          })
        }
        const to = [o.email, whatsapp ? o.phone : null].filter(Boolean).join(', ')
        return {
          kind: 'result',
          result: {
            summary:
              via === 'email'
                ? `Queued the ${config.template} email to ${to}`
                : via === 'both'
                  ? `Queued the ${config.template} email and WhatsApp to ${to}`
                  : `Queued the ${config.template} WhatsApp to ${to}`,
            output: { to, template: config.template },
          },
        }
      }
      // The order's own phone: an update about the shopper's own order needs no consent.
      const phone = normalisePhone(o.phone)
      if (!phone)
        return { kind: 'result', result: skipped('The order has no phone', 'no_recipient') }
      const { whatsapp } = await marketingChannels(tx, ctx.storeId, deps)
      if (!whatsapp) throw notConnected('WhatsApp')
      const msg = await claimMessage(tx, ctx, {
        channel: 'whatsapp',
        to: phone,
        customerId: o.customerId,
      })
      if (msg.alreadySent)
        return { kind: 'result', result: { noop: true, summary: 'Already sent' } }
      const merge = await mergeValues(tx, ctx, deps, null)
      const prepared = await prepareMarketingWhatsapp(
        tx,
        {
          messageId: msg.id,
          to: phone,
          customerId: o.customerId,
          transactional: true,
          template: config.template,
          merge,
        },
        (str, m) => fill(ctx, str, m),
      )
      if (prepared.kind === 'skipped') {
        return { kind: 'result', result: skipped('Not allowed to send', 'no_consent') }
      }
      const ref = config.template
      return {
        kind: 'send',
        messageId: msg.id,
        channel: whatsapp,
        messages: [prepared.message],
        // The provider's template list is read outside the transaction too.
        check: async () => {
          const checked = await utilityTemplate(whatsapp, ref)
          return checked.ok ? null : checked.reason
        },
        done: { summary: `Sent ${ref.name} on WhatsApp`, output: { to: phone } },
      }
    },
    async ({ tx, ctx, config }) => {
      const deps = await depsFor(tx, ctx.storeId)
      const o = await orderOf(tx, ctx)
      if (config.channel === 'email') {
        if (!isOrderUpdateTemplate(config.template)) {
          return { summary: `${config.template} is not an order message`, wouldRun: false }
        }
        if (o.email) {
          return {
            summary: `Would email ${o.email} the ${config.template} message`,
            wouldRun: true,
          }
        }
        return (await alsoWhatsapp(tx, ctx.storeId, deps, o.phone))
          ? { summary: `Would WhatsApp the ${config.template} message`, wouldRun: true }
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
  )
}
