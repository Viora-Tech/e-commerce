/** SOURCE OF TRUTH: message automation actions — WHAT: staff alerts by email and WhatsApp, Growth's consent-gated marketing email and WhatsApp, and the no-consent "Send order update" (an order email template, or a WhatsApp template the provider lists as UTILITY, only to the order's own contact), each sent at most once per step (`marketing_message` keyed by run and node) / WHY: owner answer Q4 splits customer messages into consent-gated marketing and order updates; every rule of `marketing/send.ts` (consent per channel, own address only) still applies. Server-only. Design §8.4, §8.7. */
import { cartLine, customer, order, type StoreTx } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type { ChannelTemplate, NotificationChannel, TemplateId } from '@commerce/notifications'
import { eq, sql } from 'drizzle-orm'
import { recoveryUrl } from '../../cart/abandoned'
import { decryptCustomerPhone } from '../../customers/phone-crypto'
import { normalisePhone } from '../../marketing/audience'
import {
  applyMergeTags,
  type EmailBlock,
  escapeHtml,
  type MergeValues,
} from '../../marketing/email'
import { recipientIsCustomers } from '../../marketing/recipient'
import {
  firstName,
  marketingChannels,
  sendMarketingEmail,
  sendMarketingWhatsapp,
  storeSender,
} from '../../marketing/send'
import type { WhatsappTemplateRef } from '../../marketing/whatsapp'
import { deliverNotification } from '../../notifications/deliver'
import { messageDef } from '../../notifications/messages'
import { hasMarketingConsent } from '../../privacy/client'
import { customerIdOf } from '../conditions/loaders'
import {
  type ActionContext,
  type ActionExecutor,
  type ActionPreview,
  type ActionResult,
  AutomationActionError,
} from '../executor'
import {
  type BuiltinActionDeps,
  claimMessage,
  gone,
  recordMessage,
  sendFailure,
  subjectId,
} from './shared'

const notConnected = (what: string) =>
  new AutomationActionError(`Connect ${what} in Settings → Notifications first`, {
    retryable: false,
    code: 'AUTOMATION_CHANNEL_MISSING',
  })

/** Fills `{order.number}` tags, then Growth's single-word tags (`{first_name}`). */
const fill = (ctx: ActionContext, text: string, merge: MergeValues) =>
  applyMergeTags(ctx.render(text), merge)

/** Every string inside Growth's email blocks with the run's dotted merge tags filled in. */
function renderBlocks(ctx: ActionContext, value: unknown): unknown {
  if (typeof value === 'string') return ctx.render(value)
  if (Array.isArray(value)) return value.map((v) => renderBlocks(ctx, v))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        k === 'type' || k === 'id' ? v : renderBlocks(ctx, v),
      ]),
    )
  }
  return value
}

const skipped = (summary: string, reason: string): ActionResult => ({
  noop: true,
  summary,
  output: { skipped: reason },
})

// ---------------------------------------------------------------------------------------------
// The run's people: the customer (marketing), the order (order updates)
// ---------------------------------------------------------------------------------------------

type Person = {
  customerId: string | null
  email: string | null
  phone: string | null
  name: string | null
  consent: { email: boolean; whatsapp: boolean }
}

async function runCustomer(
  tx: StoreTx,
  ctx: ActionContext,
  deps: BuiltinActionDeps,
): Promise<Person | null> {
  const id = await customerIdOf(tx, ctx.subject)
  if (!id) return null
  const [c] = await tx.select().from(customer).where(eq(customer.id, id))
  if (!c) return null
  return {
    customerId: c.id,
    email: c.email,
    phone: decryptCustomerPhone(c.phone, deps.settingsSecret),
    name: c.name,
    consent: {
      email: hasMarketingConsent(c, 'email'),
      whatsapp: hasMarketingConsent(c, 'whatsapp'),
    },
  }
}

/** Growth's merge values for the run's subject (cart link and total, order number). */
async function mergeValues(
  tx: StoreTx,
  ctx: ActionContext,
  deps: BuiltinActionDeps,
  name: string | null,
): Promise<MergeValues> {
  const sender = await storeSender(tx, ctx.storeId)
  const merge: MergeValues = {
    first_name: firstName(name),
    name: name ?? '',
    store_name: sender.storeName,
    shop_url: deps.storefrontUrl,
    checkout_url: deps.storefrontUrl,
  }
  if (ctx.subject.type === 'cart' && ctx.subject.id) {
    const [c] = await tx
      .select({
        total: sql<number>`coalesce(sum(${cartLine.quantity} * ${cartLine.unitPricePaise}), 0)::int`,
      })
      .from(cartLine)
      .where(eq(cartLine.cartId, ctx.subject.id))
    merge.checkout_url = recoveryUrl(ctx.subject.id, deps.settingsSecret, deps.storefrontUrl)
    if (c) merge.cart_total = formatMoney(Number(c.total))
  }
  if (ctx.subject.type === 'order' && ctx.subject.id) {
    const [o] = await tx
      .select({ number: order.number, total: order.totalPaise })
      .from(order)
      .where(eq(order.id, ctx.subject.id))
    if (o) {
      merge.order_number = `#${o.number}`
      merge.cart_total = formatMoney(o.total)
    }
  }
  return merge
}

// ---------------------------------------------------------------------------------------------
// Staff alerts
// ---------------------------------------------------------------------------------------------

type StaffEmailConfig = { to: string[]; subject: string; body: string }
type StaffWhatsappConfig = { to: string[]; template: WhatsappTemplateRef }

function staffEmail(deps: BuiltinActionDeps): ActionExecutor<StaffEmailConfig> {
  return {
    id: 'staff.email',
    async run({ tx, ctx, config }) {
      const { email } = await marketingChannels(tx, ctx.storeId, deps)
      if (!email?.sendMarketing) throw notConnected('an email channel')
      const msg = await claimMessage(tx, ctx, {
        channel: email.id,
        to: config.to.join(', '),
        customerId: null,
      })
      if (msg.alreadySent) return { noop: true, summary: 'Already sent' }
      const subject = ctx.render(config.subject).trim()
      const text = ctx.render(config.body)
      const html = `<div style="white-space:pre-wrap;font-family:sans-serif">${escapeHtml(text)}</div>`
      let ref = ''
      for (const to of config.to) {
        const r = await email.sendMarketing({
          kind: 'email',
          to: { email: to },
          subject,
          html,
          text,
        })
        if (!r.ok) {
          await recordMessage(tx, msg.id, { ok: false, channel: email.id, error: r.error })
          throw sendFailure(r.error, r.retryable)
        }
        ref = r.providerRef
      }
      await recordMessage(tx, msg.id, { ok: true, channel: email.id, providerRef: ref })
      return { summary: `Emailed ${config.to.join(', ')}`, output: { to: config.to, subject } }
    },
    async preview({ tx, ctx, config }) {
      const { email } = await marketingChannels(tx, ctx.storeId, deps)
      return {
        summary: `Would email ${config.to.join(', ')}: "${ctx.render(config.subject)}"`,
        wouldRun: !!email,
        warnings: email ? undefined : ['Connect an email channel in Settings → Notifications'],
        output: { body: ctx.render(config.body) },
      }
    },
  }
}

function staffWhatsapp(deps: BuiltinActionDeps): ActionExecutor<StaffWhatsappConfig> {
  return {
    id: 'staff.whatsapp',
    async run({ tx, ctx, config }) {
      const { whatsapp } = await marketingChannels(tx, ctx.storeId, deps)
      if (!whatsapp?.sendMarketing) throw notConnected('WhatsApp')
      const phones = config.to.map((p) => normalisePhone(p)).filter((p): p is string => !!p)
      if (phones.length === 0) {
        throw new AutomationActionError('None of the phone numbers is valid', { retryable: false })
      }
      const msg = await claimMessage(tx, ctx, {
        channel: whatsapp.id,
        to: phones.join(', '),
        customerId: null,
      })
      if (msg.alreadySent) return { noop: true, summary: 'Already sent' }
      const template = {
        name: config.template.name,
        language: config.template.language,
        variables: config.template.variables.map((v) => ctx.render(v)),
      }
      let ref = ''
      for (const phone of phones) {
        const r = await whatsapp.sendMarketing({
          kind: 'whatsapp_template',
          to: { phone },
          template,
        })
        if (!r.ok) {
          await recordMessage(tx, msg.id, { ok: false, channel: whatsapp.id, error: r.error })
          throw sendFailure(r.error, r.retryable)
        }
        ref = r.providerRef
      }
      await recordMessage(tx, msg.id, { ok: true, channel: whatsapp.id, providerRef: ref })
      return {
        summary: `Sent ${template.name} on WhatsApp to ${phones.length} number(s)`,
        output: { to: phones, template: template.name },
      }
    },
    async preview({ tx, ctx, config }) {
      const { whatsapp } = await marketingChannels(tx, ctx.storeId, deps)
      return {
        summary: `Would send ${config.template.name} on WhatsApp to ${config.to.join(', ')}`,
        wouldRun: !!whatsapp,
        warnings: whatsapp ? undefined : ['Connect WhatsApp and add a utility template'],
        output: { variables: config.template.variables.map((v) => ctx.render(v)) },
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Marketing messages (consent-gated, Growth's steps)
// ---------------------------------------------------------------------------------------------

type MarketingEmailConfig = { subject: string; previewText: string; blocks: EmailBlock[] }
type MarketingWhatsappConfig = { template: WhatsappTemplateRef }

const NO_CONSENT = 'no_consent'

function marketingEmail(deps: BuiltinActionDeps): ActionExecutor<MarketingEmailConfig> {
  const plan = async (tx: StoreTx, ctx: ActionContext) => {
    const person = await runCustomer(tx, ctx, deps)
    // Consent belongs to the customer, so the email goes only to their own stored address.
    if (!person?.email || !recipientIsCustomers('email', person.email, person)) {
      return { person: null, reason: 'No customer email to send to' }
    }
    if (!person.consent.email)
      return { person: null, reason: 'The customer has not agreed to marketing email' }
    return { person, reason: null }
  }
  return {
    id: 'marketing.send_email',
    async run({ tx, ctx, config }) {
      const { person, reason } = await plan(tx, ctx)
      if (!person?.email) return skipped(reason ?? 'Skipped', NO_CONSENT)
      const { email } = await marketingChannels(tx, ctx.storeId, deps)
      if (!email) return skipped('No email channel can send marketing', 'no_channel')
      const msg = await claimMessage(tx, ctx, {
        channel: 'email',
        to: person.email,
        customerId: person.customerId,
      })
      if (msg.alreadySent) return { noop: true, summary: 'Already sent' }
      const merge = await mergeValues(tx, ctx, deps, person.name)
      const sender = await storeSender(tx, ctx.storeId)
      const r = await sendMarketingEmail(tx, ctx.storeId, deps, email, sender, {
        messageId: msg.id,
        to: person.email,
        customerId: person.customerId,
        subject: fill(ctx, config.subject, merge),
        previewText: fill(ctx, config.previewText, merge),
        blocks: renderBlocks(ctx, config.blocks) as EmailBlock[],
        merge,
        utmCampaign: `automation-${ctx.workflow.id}`,
      })
      if (!r.ok) {
        if (r.error === NO_CONSENT) return skipped('The customer withdrew consent', NO_CONSENT)
        throw sendFailure(r.error, r.retryable)
      }
      return { summary: `Emailed ${person.email}`, output: { to: person.email } }
    },
    async preview({ tx, ctx, config }): Promise<ActionPreview> {
      const { person, reason } = await plan(tx, ctx)
      if (!person) return { summary: `Would send nothing: ${reason}`, wouldRun: false }
      const merge = await mergeValues(tx, ctx, deps, person.name)
      return {
        summary: `Would email ${person.email}: "${fill(ctx, config.subject, merge)}"`,
        wouldRun: true,
      }
    },
  }
}

function marketingWhatsapp(deps: BuiltinActionDeps): ActionExecutor<MarketingWhatsappConfig> {
  const plan = async (tx: StoreTx, ctx: ActionContext) => {
    const person = await runCustomer(tx, ctx, deps)
    const phone = normalisePhone(person?.phone)
    if (!person || !phone)
      return { person: null, phone: null, reason: 'No customer phone to send to' }
    if (!person.consent.whatsapp) {
      return {
        person: null,
        phone: null,
        reason: 'The customer has not agreed to WhatsApp marketing',
      }
    }
    return { person, phone, reason: null }
  }
  return {
    id: 'marketing.send_whatsapp',
    async run({ tx, ctx, config }) {
      const { person, phone, reason } = await plan(tx, ctx)
      if (!person || !phone) return skipped(reason ?? 'Skipped', NO_CONSENT)
      const { whatsapp } = await marketingChannels(tx, ctx.storeId, deps)
      if (!whatsapp) return skipped('WhatsApp is not connected', 'no_channel')
      const msg = await claimMessage(tx, ctx, {
        channel: 'whatsapp',
        to: phone,
        customerId: person.customerId,
      })
      if (msg.alreadySent) return { noop: true, summary: 'Already sent' }
      const merge = await mergeValues(tx, ctx, deps, person.name)
      const r = await sendMarketingWhatsapp(
        tx,
        whatsapp,
        {
          messageId: msg.id,
          to: phone,
          customerId: person.customerId,
          template: config.template,
          merge,
        },
        (s, m) => fill(ctx, s, m),
      )
      if (!r.ok) {
        if (r.error === NO_CONSENT) return skipped('The customer withdrew consent', NO_CONSENT)
        throw sendFailure(r.error, r.retryable)
      }
      return { summary: `Sent ${config.template.name} on WhatsApp`, output: { to: phone } }
    },
    async preview({ tx, ctx, config }) {
      const { person, reason } = await plan(tx, ctx)
      if (!person) return { summary: `Would send nothing: ${reason}`, wouldRun: false }
      return { summary: `Would send ${config.template.name} on WhatsApp`, wouldRun: true }
    },
  }
}

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

function orderUpdate(deps: BuiltinActionDeps): ActionExecutor<OrderUpdateConfig> {
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

export const messageExecutors = (deps: BuiltinActionDeps): ActionExecutor<never>[] =>
  [
    staffEmail(deps),
    staffWhatsapp(deps),
    marketingEmail(deps),
    marketingWhatsapp(deps),
    orderUpdate(deps),
  ] as unknown as ActionExecutor<never>[]
