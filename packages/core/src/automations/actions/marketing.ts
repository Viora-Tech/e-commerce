/** SOURCE OF TRUTH: marketing message automation actions — WHAT: Growth's "Send email" and "Send WhatsApp" steps on the engine: to the run's contact (`automation_run.email/phone`, else the order's or cart's, else the customer's), only with the customer's consent on that channel and only when that contact is the customer's own (else the message row is skipped as `recipient_mismatch`); the COD confirmation (first step of an `order.cod_placed` workflow, on WhatsApp) is transactional and needs no consent; the abandoned-cart email gets its cart block, `discount_code` comes from the discount block, a cart send marks `cart.recovery_sent_at`, and Growth workflows keep their `automation-<template>` UTM / WHY: the six Growth automations moved onto the engine must send exactly what `processDueRuns` sent (design §10; owner answer Q4). Server-only. */
import {
  automationRun,
  automationVersion,
  automationWorkflow,
  cart,
  customer,
  marketingMessage,
  order,
  type StoreTx,
} from '@commerce/db'
import { formatMoney } from '@commerce/money'
import { eq, sql } from 'drizzle-orm'
import { decryptCustomerPhone } from '../../customers/phone-crypto'
import { normalisePhone } from '../../marketing/audience'
import { cartFacts } from '../../marketing/automations'
import type { EmailBlock, MergeValues } from '../../marketing/email'
import { RECIPIENT_MISMATCH, recipientIsCustomers } from '../../marketing/recipient'
import {
  marketingChannels,
  sendMarketingEmail,
  sendMarketingWhatsapp,
  storeSender,
} from '../../marketing/send'
import type { WhatsappTemplateRef } from '../../marketing/whatsapp'
import { hasMarketingConsent } from '../../privacy/client'
import { customerIdOf } from '../conditions/loaders'
import type { ActionContext, ActionExecutor, ActionPreview, ActionResult } from '../executor'
import { fill, mergeValues, renderBlocks, skipped } from './messages'
import { type BuiltinActionDeps, claimMessage, type DepsFor, sendFailure } from './shared'

type EmailConfig = { subject: string; previewText: string; blocks: EmailBlock[] }
type WhatsappConfig = { template: WhatsappTemplateRef }

const NO_CONSENT = 'no_consent'
/** The trigger whose first WhatsApp step is the COD confirmation (Growth's `cod_order_placed`). */
const COD_TRIGGER = 'order.cod_placed'

/** Who the step is about and how to reach them, as Growth's run row held it. */
type Audience = {
  customer: {
    id: string
    email: string | null
    phone: string | null
    name: string | null
    consent: { email: boolean; whatsapp: boolean }
  } | null
  email: string | null
  phone: string | null
  name: string | null
  cartId: string | null
}

async function audience(
  tx: StoreTx,
  ctx: ActionContext,
  deps: BuiltinActionDeps,
): Promise<Audience> {
  const [run] = ctx.runId
    ? await tx.select().from(automationRun).where(eq(automationRun.id, ctx.runId))
    : []
  // The subject's own contact, for runs that did not snapshot one.
  let subjectEmail: string | null = null
  let subjectPhone: string | null = null
  let cartId = run?.cartId ?? (ctx.subject.type === 'cart' ? ctx.subject.id : null)
  if (ctx.subject.type === 'order' && ctx.subject.id) {
    const [o] = await tx
      .select({ email: order.email, phone: order.phone })
      .from(order)
      .where(eq(order.id, ctx.subject.id))
    subjectEmail = o?.email ?? null
    subjectPhone = o?.phone ?? null
  }
  if (ctx.subject.type === 'cart' && ctx.subject.id) {
    const [c] = await tx
      .select({ email: cart.email, phone: cart.phone })
      .from(cart)
      .where(eq(cart.id, ctx.subject.id))
    subjectEmail = c?.email ?? null
    subjectPhone = c?.phone ?? null
    cartId = ctx.subject.id
  }
  const customerId = run?.customerId ?? (await customerIdOf(tx, ctx.subject))
  const [c] = customerId ? await tx.select().from(customer).where(eq(customer.id, customerId)) : []
  const cu = c
    ? {
        id: c.id,
        email: c.email,
        phone: decryptCustomerPhone(c.phone, deps.settingsSecret),
        name: c.name,
        consent: {
          email: hasMarketingConsent(c, 'email'),
          whatsapp: hasMarketingConsent(c, 'whatsapp'),
        },
      }
    : null
  return {
    customer: cu,
    email: run?.email ?? subjectEmail ?? cu?.email ?? null,
    phone: run?.phone ?? subjectPhone ?? cu?.phone ?? null,
    name: run?.name ?? cu?.name ?? null,
    cartId,
  }
}

/** Growth's UTM: `automation-<template>` for its own workflows, else the workflow id. */
async function workflowFacts(tx: StoreTx, ctx: ActionContext) {
  const [w] = await tx
    .select({ origin: automationWorkflow.origin, templateId: automationWorkflow.templateId })
    .from(automationWorkflow)
    .where(eq(automationWorkflow.id, ctx.workflow.id))
  const [v] = await tx
    .select({ definition: automationVersion.definition })
    .from(automationVersion)
    .where(eq(automationVersion.id, ctx.workflow.versionId))
  const def = (v?.definition ?? {}) as { start?: unknown; trigger?: { type?: unknown } }
  const utm =
    w?.origin === 'growth' && w.templateId
      ? `automation-${w.templateId}`
      : `automation-${ctx.workflow.id}`
  return {
    utm,
    /** The COD confirmation: an update about the shopper's own order, no consent needed. */
    codConfirmation: def.trigger?.type === COD_TRIGGER && def.start === ctx.nodeId,
  }
}

async function markSkipped(tx: StoreTx, messageId: string, reason: string) {
  await tx
    .update(marketingMessage)
    .set({ status: 'skipped', error: reason })
    .where(eq(marketingMessage.id, messageId))
}

/** The abandoned-checkout list shows the nudge (Growth kept this legacy flag in step). */
async function markRecoverySent(tx: StoreTx, cartId: string | null) {
  if (!cartId) return
  await tx
    .update(cart)
    .set({ recoverySentAt: sql`coalesce(${cart.recoverySentAt}, now())` })
    .where(eq(cart.id, cartId))
}

const mismatch = (): ActionResult => skipped('Not the customer’s own address', RECIPIENT_MISMATCH)

// ---------------------------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------------------------

function emailPlan(a: Audience): { to: string } | { reason: string } {
  if (!a.email) return { reason: 'No email to send to' }
  if (!a.customer?.consent.email)
    return { reason: 'The customer has not agreed to marketing email' }
  return { to: a.email }
}

function marketingEmail(depsFor: DepsFor): ActionExecutor<EmailConfig> {
  return {
    id: 'marketing.send_email',
    async run({ tx, ctx, config }) {
      const deps = await depsFor(tx, ctx.storeId)
      const a = await audience(tx, ctx, deps)
      const plan = emailPlan(a)
      if ('reason' in plan) return skipped(plan.reason, NO_CONSENT)
      const { email } = await marketingChannels(tx, ctx.storeId, deps)
      if (!email) return skipped('No email channel can send marketing', 'no_channel')
      const msg = await claimMessage(tx, ctx, {
        channel: 'email',
        to: plan.to,
        customerId: a.customer?.id ?? null,
      })
      if (msg.alreadySent) return { noop: true, summary: 'Already sent' }
      // Consent is the customer's; the typed checkout email may be someone else's.
      if (!recipientIsCustomers('email', plan.to, a.customer)) {
        await markSkipped(tx, msg.id, RECIPIENT_MISMATCH)
        return mismatch()
      }
      const discount = config.blocks.find((b) => b.type === 'discount')
      const merge: MergeValues = {
        ...(await mergeValues(tx, ctx, deps, a.name, a.cartId)),
        discount_code: discount?.type === 'discount' ? discount.code : '',
      }
      const facts = a.cartId ? await cartFacts(tx, a.cartId) : null
      const { utm } = await workflowFacts(tx, ctx)
      const r = await sendMarketingEmail(
        tx,
        ctx.storeId,
        deps,
        email,
        await storeSender(tx, ctx.storeId),
        {
          messageId: msg.id,
          to: plan.to,
          customerId: a.customer?.id ?? null,
          subject: fill(ctx, config.subject, merge),
          previewText: config.previewText,
          blocks: renderBlocks(ctx, config.blocks) as EmailBlock[],
          merge,
          cart: facts
            ? { lines: facts.lines, totalLabel: formatMoney(facts.totalPaise) }
            : undefined,
          utmCampaign: utm,
        },
      )
      if (!r.ok) {
        if (r.error === NO_CONSENT) return skipped('The customer withdrew consent', NO_CONSENT)
        throw sendFailure(r.error, r.retryable)
      }
      await markRecoverySent(tx, a.cartId)
      return { summary: `Emailed ${plan.to}`, output: { to: plan.to } }
    },
    async preview({ tx, ctx, config }): Promise<ActionPreview> {
      const deps = await depsFor(tx, ctx.storeId)
      const a = await audience(tx, ctx, deps)
      const plan = emailPlan(a)
      if ('reason' in plan)
        return { summary: `Would send nothing: ${plan.reason}`, wouldRun: false }
      if (!recipientIsCustomers('email', plan.to, a.customer)) {
        return { summary: 'Would send nothing: not the customer’s own address', wouldRun: false }
      }
      const merge = await mergeValues(tx, ctx, deps, a.name, a.cartId)
      return {
        summary: `Would email ${plan.to}: "${fill(ctx, config.subject, merge)}"`,
        wouldRun: true,
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------------------------

function whatsappPlan(a: Audience, transactional: boolean): { to: string } | { reason: string } {
  const to = normalisePhone(a.phone)
  if (!to) return { reason: 'No phone to send to' }
  if (!transactional && !a.customer?.consent.whatsapp) {
    return { reason: 'The customer has not agreed to WhatsApp marketing' }
  }
  return { to }
}

function marketingWhatsapp(depsFor: DepsFor): ActionExecutor<WhatsappConfig> {
  return {
    id: 'marketing.send_whatsapp',
    async run({ tx, ctx, config }) {
      const deps = await depsFor(tx, ctx.storeId)
      const a = await audience(tx, ctx, deps)
      const { codConfirmation: transactional } = await workflowFacts(tx, ctx)
      const plan = whatsappPlan(a, transactional)
      if ('reason' in plan) return skipped(plan.reason, NO_CONSENT)
      const { whatsapp } = await marketingChannels(tx, ctx.storeId, deps)
      if (!whatsapp) return skipped('WhatsApp is not connected', 'no_channel')
      const msg = await claimMessage(tx, ctx, {
        channel: 'whatsapp',
        to: plan.to,
        customerId: a.customer?.id ?? null,
      })
      if (msg.alreadySent) return { noop: true, summary: 'Already sent' }
      // The COD confirmation goes to the order's own phone; marketing only to the phone
      // stored on the consenting customer, never a typed one.
      if (!transactional && !recipientIsCustomers('phone', plan.to, a.customer)) {
        await markSkipped(tx, msg.id, RECIPIENT_MISMATCH)
        return mismatch()
      }
      const merge = await mergeValues(tx, ctx, deps, a.name, a.cartId)
      const r = await sendMarketingWhatsapp(
        tx,
        whatsapp,
        {
          messageId: msg.id,
          to: plan.to,
          customerId: a.customer?.id ?? null,
          transactional,
          template: config.template,
          merge,
        },
        (s, m) => fill(ctx, s, m),
      )
      if (!r.ok) {
        if (r.error === NO_CONSENT) return skipped('The customer withdrew consent', NO_CONSENT)
        throw sendFailure(r.error, r.retryable)
      }
      await markRecoverySent(tx, a.cartId)
      return {
        summary: `Sent ${config.template.name} on WhatsApp`,
        output: { to: plan.to, transactional },
      }
    },
    async preview({ tx, ctx, config }) {
      const deps = await depsFor(tx, ctx.storeId)
      const a = await audience(tx, ctx, deps)
      const { codConfirmation } = await workflowFacts(tx, ctx)
      const plan = whatsappPlan(a, codConfirmation)
      if ('reason' in plan)
        return { summary: `Would send nothing: ${plan.reason}`, wouldRun: false }
      if (!codConfirmation && !recipientIsCustomers('phone', plan.to, a.customer)) {
        return { summary: 'Would send nothing: not the customer’s own phone', wouldRun: false }
      }
      return { summary: `Would send ${config.template.name} on WhatsApp`, wouldRun: true }
    },
  }
}

export const marketingExecutors = (depsFor: DepsFor): ActionExecutor<never>[] =>
  [marketingEmail(depsFor), marketingWhatsapp(depsFor)] as unknown as ActionExecutor<never>[]
