/** SOURCE OF TRUTH: staff alert automation actions and shared message helpers — WHAT: alert the team by email or on WhatsApp (sent at most once per step, `marketing_message` keyed by run and node), plus the merge values, merge-tag fill and skip results the customer-message actions (`marketing.ts`, `order-update.ts`) share / WHY: one place renders Growth's single-word tags next to the run's dotted ones. Server-only. Design §8.4. */
import { cartLine, order, type StoreTx } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import { eq, sql } from 'drizzle-orm'
import { recoveryUrl } from '../../cart/abandoned'
import { normalisePhone } from '../../marketing/audience'
import { productFacts } from '../../marketing/browse'
import { applyMergeTags, escapeHtml, type MergeValues } from '../../marketing/email'
import { firstName, marketingChannels, storeSender } from '../../marketing/send'
import type { WhatsappTemplateRef } from '../../marketing/whatsapp'
import {
  type ActionContext,
  type ActionExecutor,
  type ActionResult,
  AutomationActionError,
} from '../executor'
import { messageExecutor } from './outbound'
import { type BuiltinActionDeps, claimMessage, type DepsFor } from './shared'

export const notConnected = (what: string) =>
  new AutomationActionError(`Connect ${what} in Settings → Notifications first`, {
    retryable: false,
    code: 'AUTOMATION_CHANNEL_MISSING',
  })

/** Fills `{order.number}` tags, then Growth's single-word tags (`{first_name}`). */
export const fill = (ctx: ActionContext, text: string, merge: MergeValues) =>
  applyMergeTags(ctx.render(text), merge)

/** Every string inside Growth's email blocks with the run's dotted merge tags filled in. */
export function renderBlocks(ctx: ActionContext, value: unknown): unknown {
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

export const skipped = (summary: string, reason: string): ActionResult => ({
  noop: true,
  summary,
  output: { skipped: reason },
})

/** Growth's merge values for the run's subject (cart link and total, order number). */
export async function mergeValues(
  tx: StoreTx,
  ctx: ActionContext,
  deps: BuiltinActionDeps,
  name: string | null,
  cartId: string | null = ctx.subject.type === 'cart' ? ctx.subject.id : null,
): Promise<MergeValues> {
  const sender = await storeSender(tx, ctx.storeId)
  const merge: MergeValues = {
    first_name: firstName(name),
    name: name ?? '',
    store_name: sender.storeName,
    shop_url: deps.storefrontUrl,
    checkout_url: deps.storefrontUrl,
  }
  if (cartId) {
    const [c] = await tx
      .select({
        total: sql<number>`coalesce(sum(${cartLine.quantity} * ${cartLine.unitPricePaise}), 0)::int`,
      })
      .from(cartLine)
      .where(eq(cartLine.cartId, cartId))
    merge.checkout_url = recoveryUrl(cartId, deps.settingsSecret, deps.storefrontUrl)
    if (c) merge.cart_total = formatMoney(Number(c.total))
  }
  if (ctx.subject.type === 'order' && ctx.subject.id && !cartId) {
    const [o] = await tx
      .select({ number: order.number, total: order.totalPaise })
      .from(order)
      .where(eq(order.id, ctx.subject.id))
    if (o) {
      merge.order_number = `#${o.number}`
      merge.cart_total = formatMoney(o.total)
    }
  }
  // Browse abandonment: the product the shopper looked at (`{product_title}`, `{product_url}`).
  const productId = ctx.triggerData.productId
  if (typeof productId === 'string' && productId) {
    Object.assign(merge, await productFacts(tx, productId, deps.storefrontUrl))
  }
  return merge
}

// ---------------------------------------------------------------------------------------------
// Staff alerts
// ---------------------------------------------------------------------------------------------

type StaffEmailConfig = { to: string[]; subject: string; body: string }
type StaffWhatsappConfig = { to: string[]; template: WhatsappTemplateRef }

function staffEmail(depsFor: DepsFor): ActionExecutor<StaffEmailConfig> {
  return messageExecutor<StaffEmailConfig>(
    'staff.email',
    async ({ tx, ctx, config }) => {
      const deps = await depsFor(tx, ctx.storeId)
      const { email } = await marketingChannels(tx, ctx.storeId, deps)
      if (!email?.sendMarketing) throw notConnected('an email channel')
      const msg = await claimMessage(tx, ctx, {
        channel: email.id,
        to: config.to.join(', '),
        customerId: null,
      })
      if (msg.alreadySent)
        return { kind: 'result', result: { noop: true, summary: 'Already sent' } }
      const subject = ctx.render(config.subject).trim()
      const text = ctx.render(config.body)
      const html = `<div style="white-space:pre-wrap;font-family:sans-serif">${escapeHtml(text)}</div>`
      return {
        kind: 'send',
        messageId: msg.id,
        channel: email,
        messages: config.to.map((to) => ({
          kind: 'email' as const,
          to: { email: to },
          subject,
          html,
          text,
        })),
        done: { summary: `Emailed ${config.to.join(', ')}`, output: { to: config.to, subject } },
      }
    },
    async ({ tx, ctx, config }) => {
      const deps = await depsFor(tx, ctx.storeId)
      const { email } = await marketingChannels(tx, ctx.storeId, deps)
      return {
        summary: `Would email ${config.to.join(', ')}: "${ctx.render(config.subject)}"`,
        wouldRun: !!email,
        warnings: email ? undefined : ['Connect an email channel in Settings → Notifications'],
        output: { body: ctx.render(config.body) },
      }
    },
  )
}

function staffWhatsapp(depsFor: DepsFor): ActionExecutor<StaffWhatsappConfig> {
  return messageExecutor<StaffWhatsappConfig>(
    'staff.whatsapp',
    async ({ tx, ctx, config }) => {
      const deps = await depsFor(tx, ctx.storeId)
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
      if (msg.alreadySent)
        return { kind: 'result', result: { noop: true, summary: 'Already sent' } }
      const template = {
        name: config.template.name,
        language: config.template.language,
        variables: config.template.variables.map((v) => ctx.render(v)),
      }
      return {
        kind: 'send',
        messageId: msg.id,
        channel: whatsapp,
        messages: phones.map((phone) => ({
          kind: 'whatsapp_template' as const,
          to: { phone },
          template,
        })),
        done: {
          summary: `Sent ${template.name} on WhatsApp to ${phones.length} number(s)`,
          output: { to: phones, template: template.name },
        },
      }
    },
    async ({ tx, ctx, config }) => {
      const deps = await depsFor(tx, ctx.storeId)
      const { whatsapp } = await marketingChannels(tx, ctx.storeId, deps)
      return {
        summary: `Would send ${config.template.name} on WhatsApp to ${config.to.join(', ')}`,
        wouldRun: !!whatsapp,
        warnings: whatsapp ? undefined : ['Connect WhatsApp and add a utility template'],
        output: { variables: config.template.variables.map((v) => ctx.render(v)) },
      }
    },
  )
}

export const messageExecutors = (depsFor: DepsFor): ActionExecutor<never>[] =>
  [staffEmail(depsFor), staffWhatsapp(depsFor)] as unknown as ActionExecutor<never>[]
