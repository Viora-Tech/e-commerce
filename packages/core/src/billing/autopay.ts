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
import { autopayMandate, type Db, order, payment, withStore } from '@commerce/db'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { CommerceError } from '../errors'
import { applyPaymentStatus } from '../payments/confirm'
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

/**
 * "Turn on UPI AutoPay": a Razorpay plan for the store's plan price (GST included) and a
 * subscription on it; the answer is the page where the owner approves the UPI mandate.
 */
export async function startAutopay(
  db: Db,
  storeId: string,
  input: { plan: PlanId; interval: BillingInterval },
  cfg: AutopayConfig,
): Promise<{ approveUrl: string }> {
  const amount = Math.round(PLANS[input.plan].pricePaise[input.interval] * GST)
  const rzpPlan = await rzp<{ id: string }>(cfg, '/plans', {
    period: input.interval === 'year' ? 'yearly' : 'monthly',
    interval: 1,
    item: {
      name: `${siteConfig.brand.name} ${input.plan} (${input.interval})`,
      amount,
      currency: 'INR',
    },
    notes: { storeId },
  })
  const sub = await rzp<{ id: string; short_url: string }>(cfg, '/subscriptions', {
    plan_id: rzpPlan.id,
    total_count: input.interval === 'year' ? 10 : 120,
    quantity: 1,
    customer_notify: 1,
    notes: { storeId, plan: input.plan, interval: input.interval },
  })
  await withStore(db, storeId, async (tx) => {
    await tx
      .update(autopayMandate)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(autopayMandate.storeId, storeId), eq(autopayMandate.status, 'created')))
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
  const rows = await withStore(db, storeId, (tx) =>
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
  for (const row of rows) {
    await rzp(cfg, `/subscriptions/${row.subscriptionId}/cancel`, {
      cancel_at_cycle_end: 0,
    }).catch(() => undefined)
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
  if (status) {
    await withStore(db, storeId, (tx) =>
      tx
        .update(autopayMandate)
        .set({ status, updatedAt: now })
        .where(eq(autopayMandate.id, mandate.id)),
    )
    return 'ok'
  }
  if (body.event !== 'subscription.charged') return 'ignored'
  const paymentId = body.payload?.payment?.entity?.id
  if (!paymentId || mandate.lastPaymentId === paymentId) return 'ignored'
  if (!billing.salesStoreId) return 'ignored'

  // The period's bill, paid by the charge: the sales order's payment is captured, so the
  // order is paid and the relay activates the plan and issues the GST invoice.
  const bill = await createPlanBill(
    db,
    storeId,
    { plan: mandate.plan, interval: mandate.interval, periodStart: now },
    billing,
  )
  const salesStoreId = billing.salesStoreId
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
  await withStore(db, storeId, (tx) =>
    tx
      .update(autopayMandate)
      .set({ status: 'active', lastPaymentId: paymentId, updatedAt: now })
      .where(eq(autopayMandate.id, mandate.id)),
  )
  return 'ok'
}
