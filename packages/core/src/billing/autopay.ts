/** SOURCE OF TRUTH: plan UPI AutoPay — WHAT: Razorpay subscriptions and their webhook charges / WHY: each charge becomes a plan bill paid like a link */
/**
 * UPI AutoPay for plans: a Razorpay subscription on the platform's own Razorpay account. The
 * owner approves a UPI mandate once (Razorpay's hosted page); every period Razorpay charges it
 * and tells us by webhook. Each charge becomes a plan bill whose sales-store order is marked
 * paid, so the usual `order.paid` path activates the plan and the GST-invoice app issues the
 * invoice, exactly as for a bill paid by link.
 *
 * Razorpay Subscriptions API (plain fetch, basic auth): POST /v1/plans, POST /v1/subscriptions,
 * POST /v1/subscriptions/{id}/cancel; webhooks signed with HMAC-SHA256 of the raw body.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { siteConfig } from '@commerce/config/site'
import { autopayMandate, type Db, order, payment, storePlan, withStore } from '@commerce/db'
import { and, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { CommerceError } from '../errors'
import { applyPaymentStatus } from '../payments/confirm'
import { planBillWhat, sendPlanBillEmail } from './emails'
import { FOUNDING_OFFER, foundingApplies, foundingMonthsLeft } from './founding-offer'
import { loadFoundingState } from './founding-offer-service'
import { type BillingInterval, PLANS, type PlanId } from './plans'
import { type BillingEnv, createPlanBill } from './service'

const API = 'https://api.razorpay.com/v1'
const GST = 1.18

export type AutopayConfig = {
  keyId: string
  keySecret: string
  webhookSecret: string
  fetch: typeof fetch
}

/** The platform Razorpay keys, or null while AutoPay is off. */
export function autopayConfig(env: Record<string, string | undefined>): AutopayConfig | null {
  const keyId = env.PLATFORM_RAZORPAY_KEY_ID?.trim()
  const keySecret = env.PLATFORM_RAZORPAY_KEY_SECRET?.trim()
  const webhookSecret = env.PLATFORM_RAZORPAY_WEBHOOK_SECRET?.trim()
  return keyId && keySecret && webhookSecret ? { keyId, keySecret, webhookSecret, fetch } : null
}

export class AutopayError extends CommerceError {
  constructor(message: string) {
    super('AUTOPAY_FAILED', message)
  }
}

async function rzp<T>(cfg: AutopayConfig, path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await cfg.fetch(`${API}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new AutopayError('Could not reach Razorpay. Try again in a minute.')
  }
  const json = (await res.json().catch(() => ({}))) as { error?: { description?: string } }
  if (!res.ok) throw new AutopayError(json.error?.description ?? 'Razorpay refused the request.')
  return json as T
}

export type AutopayView = {
  status: 'created' | 'active' | 'halted' | 'cancelled'
  plan: PlanId
  interval: BillingInterval
  /** Where to approve the mandate while `created`. */
  approveUrl: string | null
} | null

/** The store's current mandate (the newest one not cancelled), for Plan & billing. */
export async function loadAutopay(db: Db, storeId: string): Promise<AutopayView> {
  const [row] = await withStore(db, storeId, (tx) =>
    tx
      .select()
      .from(autopayMandate)
      .where(
        and(
          eq(autopayMandate.storeId, storeId),
          inArray(autopayMandate.status, ['created', 'active', 'halted']),
        ),
      )
      .orderBy(desc(autopayMandate.createdAt))
      .limit(1),
  )
  return row
    ? { status: row.status, plan: row.plan, interval: row.interval, approveUrl: row.shortUrl }
    : null
}

/** True while AutoPay charges the plan, so the sweep sends no pay-link bills. */
export async function autopayActive(db: Db, storeId: string): Promise<boolean> {
  return (await loadAutopay(db, storeId))?.status === 'active'
}

/** The store's mandates that are not cancelled. */
const openMandates = (db: Db, storeId: string) =>
  withStore(db, storeId, (tx) =>
    tx
      .select()
      .from(autopayMandate)
      .where(
        and(
          eq(autopayMandate.storeId, storeId),
          inArray(autopayMandate.status, ['created', 'active', 'halted']),
        ),
      ),
  )

/** Best effort: a subscription Razorpay already ended refuses, which changes nothing here. */
const cancelAtRazorpay = (cfg: AutopayConfig, subscriptionId: string) =>
  rzp(cfg, `/subscriptions/${subscriptionId}/cancel`, { cancel_at_cycle_end: 0 }).catch(
    () => undefined,
  )

/**
 * "Turn on UPI AutoPay": a Razorpay plan for the store's plan price (GST included) and a
 * subscription on it; the answer is the page where the owner approves the UPI mandate.
 *
 * A founding store on monthly Growth: the Razorpay plan is made at ₹999 + GST and the
 * subscription runs only for its founding months left. Razorpay then completes it
 * (`subscription.completed` turns the mandate off), renewals go back to pay links at the normal
 * price, and the owner can turn AutoPay on again at that price. No dashboard step: Razorpay
 * plans are created through the API, one per subscription, as before.
 */
export async function startAutopay(
  db: Db,
  storeId: string,
  input: { plan: PlanId; interval: BillingInterval },
  cfg: AutopayConfig,
): Promise<{ approveUrl: string }> {
  const founding = await withStore(db, storeId, (tx) => loadFoundingState(tx, storeId))
  const isFounding = foundingApplies(founding, input.plan, input.interval)
  const amount = Math.round(
    (isFounding ? FOUNDING_OFFER.pricePaise : PLANS[input.plan].pricePaise[input.interval]) * GST,
  )
  if (amount <= 0) throw new AutopayError('This plan has nothing to charge.')
  const open = await openMandates(db, storeId)
  // A second subscription beside a working one would charge the plan twice.
  if (open.some((m) => m.status === 'active'))
    throw new AutopayError('UPI AutoPay is already on for this store.')
  const rzpPlan = await rzp<{ id: string }>(cfg, '/plans', {
    period: input.interval === 'year' ? 'yearly' : 'monthly',
    interval: 1,
    item: {
      name: `${siteConfig.brand.name} ${input.plan} (${input.interval})${isFounding ? ' founding offer' : ''}`,
      amount,
      currency: 'INR',
    },
    notes: { storeId },
  })
  const sub = await rzp<{ id: string; short_url: string }>(cfg, '/subscriptions', {
    plan_id: rzpPlan.id,
    total_count: isFounding ? foundingMonthsLeft(founding) : input.interval === 'year' ? 10 : 120,
    quantity: 1,
    customer_notify: 1,
    notes: { storeId, plan: input.plan, interval: input.interval },
  })
  // The mandates this one replaces (never approved, or halted) are cancelled at Razorpay too:
  // an old approve link opened later would otherwise start a second subscription that charges.
  for (const old of open) await cancelAtRazorpay(cfg, old.subscriptionId)
  await withStore(db, storeId, async (tx) => {
    await tx
      .update(autopayMandate)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(
        and(
          eq(autopayMandate.storeId, storeId),
          inArray(autopayMandate.status, ['created', 'halted']),
        ),
      )
    await tx.insert(autopayMandate).values({
      storeId,
      plan: input.plan,
      interval: input.interval,
      subscriptionId: sub.id,
      shortUrl: sub.short_url,
    })
  })
  return { approveUrl: sub.short_url }
}

/** "Turn off AutoPay": the subscription is cancelled now; renewals go back to pay links. */
export async function cancelAutopay(db: Db, storeId: string, cfg: AutopayConfig): Promise<void> {
  for (const row of await openMandates(db, storeId)) {
    await cancelAtRazorpay(cfg, row.subscriptionId)
    await withStore(db, storeId, (tx) =>
      tx
        .update(autopayMandate)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(autopayMandate.id, row.id)),
    )
  }
}

/** Razorpay's webhook signature: HMAC-SHA256 of the raw body with the webhook secret. */
function verifyAutopaySignature(raw: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(createHmac('sha256', secret).update(raw).digest('hex'))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

type WebhookBody = {
  event?: string
  payload?: {
    subscription?: { entity?: { id?: string } }
    payment?: { entity?: { id?: string } }
  }
}

const STATUS_FOR: Record<string, 'active' | 'halted' | 'cancelled'> = {
  'subscription.activated': 'active',
  'subscription.authenticated': 'active',
  'subscription.resumed': 'active',
  'subscription.halted': 'halted',
  'subscription.paused': 'halted',
  'subscription.cancelled': 'cancelled',
  'subscription.completed': 'cancelled',
}

/**
 * One AutoPay webhook. `subscription.charged` bills the period and marks its sales order paid
 * (once per Razorpay payment); the other events move the mandate's status.
 */
export async function handleAutopayWebhook(
  db: Db,
  raw: string,
  signature: string,
  cfg: AutopayConfig,
  billing: BillingEnv,
  now = new Date(),
): Promise<'ok' | 'ignored' | 'bad_signature'> {
  if (!verifyAutopaySignature(raw, signature, cfg.webhookSecret)) return 'bad_signature'
  const body = JSON.parse(raw) as WebhookBody
  const subId = body.payload?.subscription?.entity?.id
  if (!subId || !body.event) return 'ignored'
  const rows = await db.execute<{ id: string | null }>(sql`select autopay_store(${subId}) as id`)
  const storeId = rows[0]?.id
  if (!storeId) return 'ignored'
  const [mandate] = await withStore(db, storeId, (tx) =>
    tx.select().from(autopayMandate).where(eq(autopayMandate.subscriptionId, subId)),
  )
  if (!mandate) return 'ignored'

  const status = STATUS_FOR[body.event]
  // Turned off here (or replaced by a newer mandate): a late or out-of-order event never turns it
  // back on. One that says it runs again is cancelled at Razorpay, so it cannot charge.
  if (status && mandate.status === 'cancelled') {
    if (status === 'active') await cancelAtRazorpay(cfg, subId)
    return 'ok'
  }
  if (status) {
    await withStore(db, storeId, (tx) =>
      tx
        .update(autopayMandate)
        .set({ status, updatedAt: now })
        .where(eq(autopayMandate.id, mandate.id)),
    )
    // Razorpay stopped retrying a failed charge: tell the owner now, not at the overdue email.
    // Once per halt (a repeated webhook finds the mandate already halted).
    if (body.event === 'subscription.halted' && mandate.status !== 'halted')
      await sendPlanBillEmail(db, storeId, {
        kind: 'autopay_failed',
        what: planBillWhat(mandate.plan, mandate.interval),
        amountPaise: 0,
        due: now,
        url: `${siteConfig.urls.admin}/settings/billing`,
      })
    return 'ok'
  }
  if (body.event !== 'subscription.charged') return 'ignored'
  const paymentId = body.payload?.payment?.entity?.id
  if (!paymentId || mandate.lastPaymentId === paymentId) return 'ignored'
  const salesStoreId = billing.salesStoreId
  if (!salesStoreId) return 'ignored'
  // Razorpay repeats webhooks, sometimes two at once: only the call that moves
  // `last_payment_id` onto this payment bills it, and a payment some bill was already paid with
  // (an older event replayed after a newer charge) is never billed again.
  const [claimed] = await withStore(db, storeId, (tx) =>
    tx
      .update(autopayMandate)
      .set({ lastPaymentId: paymentId, updatedAt: now })
      .where(
        and(
          eq(autopayMandate.id, mandate.id),
          or(isNull(autopayMandate.lastPaymentId), ne(autopayMandate.lastPaymentId, paymentId)),
        ),
      )
      .returning({ id: autopayMandate.id }),
  )
  if (!claimed) return 'ignored'
  const [billed] = await withStore(db, salesStoreId, (tx) =>
    tx
      .select({ id: payment.id })
      .from(payment)
      .where(eq(payment.providerPaymentId, paymentId))
      .limit(1),
  )
  if (billed) return 'ignored'
  try {
    await billCharge(db, storeId, salesStoreId, mandate, paymentId, billing, now)
  } catch (err) {
    // Nothing was billed: give the claim back so Razorpay's retry of this webhook bills it.
    await withStore(db, storeId, (tx) =>
      tx
        .update(autopayMandate)
        .set({ lastPaymentId: mandate.lastPaymentId })
        .where(and(eq(autopayMandate.id, mandate.id), eq(autopayMandate.lastPaymentId, paymentId))),
    )
    throw err
  }
  // A charge on a mandate turned off here was still money taken: it is billed above, the mandate
  // stays off, and Razorpay is told again to stop.
  if (mandate.status === 'cancelled') {
    await cancelAtRazorpay(cfg, subId)
    return 'ok'
  }
  await withStore(db, storeId, (tx) =>
    tx
      .update(autopayMandate)
      .set({ status: 'active', updatedAt: now })
      .where(eq(autopayMandate.id, mandate.id)),
  )
  return 'ok'
}

/**
 * The period's bill, paid by the charge: the sales order's payment is captured, so the order is
 * paid and the relay activates the plan and issues the GST invoice. The period starts where the
 * paid time (or trial) ends, never earlier: the first charge comes when the owner approves the
 * mandate, often with days of the current period left.
 */
async function billCharge(
  db: Db,
  storeId: string,
  salesStoreId: string,
  mandate: typeof autopayMandate.$inferSelect,
  paymentId: string,
  billing: BillingEnv,
  now: Date,
) {
  const [current] = await withStore(db, storeId, (tx) =>
    tx
      .select({ periodEnd: storePlan.periodEnd, trialEndsAt: storePlan.trialEndsAt })
      .from(storePlan)
      .where(eq(storePlan.storeId, storeId)),
  )
  const ends = current?.periodEnd ?? current?.trialEndsAt ?? null
  const bill = await createPlanBill(
    db,
    storeId,
    {
      plan: mandate.plan,
      interval: mandate.interval,
      periodStart: ends && ends > now ? ends : now,
    },
    billing,
  )
  await withStore(db, salesStoreId, async (tx) => {
    const [attempt] = await tx
      .select({ id: payment.id })
      .from(payment)
      .innerJoin(order, eq(order.id, payment.orderId))
      .where(eq(order.number, bill.number))
      .orderBy(desc(payment.createdAt))
      .limit(1)
    if (attempt)
      await applyPaymentStatus(
        { tx, storeId: salesStoreId },
        { paymentId: attempt.id, status: 'captured', providerPaymentId: paymentId },
      )
  })
}
