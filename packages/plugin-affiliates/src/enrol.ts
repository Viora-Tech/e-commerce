/** SOURCE OF TRUTH: Share and earn — WHAT: the signed invite a buyer gets after an order (thank-you page and order emails), whether an order earns one, and the one-tap join that makes the buyer an approved affiliate / WHY: invite only, never automatic, so nobody becomes an affiliate without saying yes (design §4 auto-enrol, DPDP) */
import { decryptCustomerPhone, openToken, signToken } from '@commerce/core'
import { customer, order, type StoreTx } from '@commerce/db'
import type { OrderLink, OrderLinkContext } from '@commerce/plugins'
import { eq } from 'drizzle-orm'
import { type AffiliateRow, affiliateForCustomer, applyAsAffiliate } from './affiliates'
import { defaultProgram, getProgram, type Program } from './programs'
import { type AffiliateSettings, type CommissionRule, withProgramRules } from './settings'
import { affiliateState } from './store-settings'

/** The storefront page the invite opens. */
const ENROL_PATH = '/affiliate/join'

/** An invite stays good for 90 days: long enough to find the email again. */
const ENROL_TTL_MS = 90 * 24 * 60 * 60 * 1000

type EnrolPayload = { s: string; o: string; e: number }

function enrolToken(storeId: string, orderId: string, secret: string, now = new Date()) {
  return signToken<EnrolPayload>(
    { s: storeId, o: orderId, e: now.getTime() + ENROL_TTL_MS },
    secret,
    'affiliate-enrol',
  )
}

/** The order an invite names, when it is genuine, unexpired and for this store. */
export function enrolOrderId(
  token: unknown,
  storeId: string,
  secret: string,
  now = new Date(),
): string | null {
  const opened = openToken<EnrolPayload>(token, secret, 'affiliate-enrol', now)
  return opened.ok && opened.payload.s === storeId ? opened.payload.o : null
}

/** "10%" or "₹150": what the program pays, for the invite's label. */
export function rewardLabel(rule: CommissionRule): string {
  if (rule.type === 'percent') return `${rule.bp / 100}%`
  return `₹${(rule.paise / 100).toLocaleString('en-IN')}`
}

export type EnrolOffer = {
  orderId: string
  customerId: string
  program: Program
  settings: AffiliateSettings
  /** The buyer is an affiliate already (any status): no invite, the join returns them. */
  existing: AffiliateRow | null
}

/**
 * Whether this order earns a Share and earn invite: the app is installed and open, invites are
 * on, the order is real (not a test, not cancelled) with a customer, and it reaches the minimum.
 */
export async function enrolOffer(
  tx: StoreTx,
  storeId: string,
  orderId: string,
): Promise<EnrolOffer | null> {
  const { installed, settings } = await affiliateState(tx, storeId)
  if (!installed || !settings.active || settings.autoEnrol.mode !== 'invite') return null
  const [o] = await tx
    .select({
      customerId: order.customerId,
      status: order.status,
      isTest: order.isTest,
      totalPaise: order.totalPaise,
    })
    .from(order)
    .where(eq(order.id, orderId))
  if (!o?.customerId || o.isTest || o.status === 'cancelled' || o.status === 'draft') return null
  if (o.totalPaise < settings.autoEnrol.minOrderPaise) return null
  const chosen = settings.autoEnrol.programId
    ? await getProgram(tx, settings.autoEnrol.programId)
    : null
  // A removed or archived program falls back to the default rather than dropping the invite.
  const program = chosen && !chosen.archivedAt ? chosen : await defaultProgram(tx, storeId)
  if (!program || program.archivedAt) return null
  return {
    orderId,
    customerId: o.customerId,
    program,
    settings: withProgramRules(settings, program.rules),
    existing: await affiliateForCustomer(tx, storeId, o.customerId),
  }
}

/**
 * The buyer's one tap: makes them an approved affiliate in the invite's program, or returns the
 * affiliate they already are. The order's own customer is the affiliate, never anyone else.
 */
export async function enrolFromOrder(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  secret: string,
): Promise<AffiliateRow | null> {
  const offer = await enrolOffer(tx, storeId, orderId)
  if (!offer) return null
  if (offer.existing) return offer.existing
  const [c] = await tx
    .select({ name: customer.name, email: customer.email, phone: customer.phone })
    .from(customer)
    .where(eq(customer.id, offer.customerId))
  return applyAsAffiliate(
    tx,
    storeId,
    {
      customerId: offer.customerId,
      email: c?.email ?? null,
      phone: decryptCustomerPhone(c?.phone, secret),
      name: c?.name ?? '',
      social: '',
      message: '',
      programId: offer.program.id,
      source: 'enrolled',
    },
    // Share and earn approves at once: the buyer already bought from the store.
    { ...offer.settings, approval: 'auto' },
    secret,
  )
}

/** The "Share and earn" link on the thank-you page, the order page and order emails. */
export async function orderLinks(ctx: OrderLinkContext, orderId: string): Promise<OrderLink[]> {
  const offer = await ctx.inStore((tx) => enrolOffer(tx, ctx.storeId, orderId))
  if (!offer || offer.existing) return []
  // Emails need an absolute URL; the order page can link relative to its own host.
  if (ctx.surface === 'email' && !ctx.storefrontUrl) return []
  const base = ctx.surface === 'email' ? (ctx.storefrontUrl ?? '') : ''
  const t = enrolToken(ctx.storeId, orderId, ctx.settingsSecret)
  return [
    {
      label: `Share and earn ${rewardLabel(offer.settings.commission)} on every sale`,
      url: `${base}${ENROL_PATH}?t=${encodeURIComponent(t)}`,
    },
  ]
}
