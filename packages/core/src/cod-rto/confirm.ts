/** SOURCE OF TRUTH: COD confirmation — WHAT: the signed confirm / cancel link a cash on delivery shopper gets, what the link page shows, the shopper's answer, the merchant's "confirmed by phone", the sweep that flags unanswered orders (and cancels them when the store opted in), and how the `cod_confirm` message picks its link and channel / WHY: COD orders nobody meant to place are the biggest share of RTO; one module owns `order.cod_verification` so the storefront, the worker and the admin never disagree */
import { type Db, order, orderLine, orderNote, withStore } from '@commerce/db'
import type { NotificationChannel, Recipient, TemplateId } from '@commerce/notifications'
import { and, eq, inArray, lte, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { cancelOrder } from '../order/status'
import { insertOutboxEvent } from '../outbox/write'
import { signOrderToken, verifyOrderToken } from '../preorder/balance-link'
import { codRtoState } from './risk'
import { COD_RTO_TAGS, type CodVerification } from './settings'

const PURPOSE = 'cod-confirm'
/** Long enough to answer late; the store's own deadlines decide what happens meanwhile. */
const COD_LINK_TTL_MS = 7 * 86_400_000
const HOUR_MS = 3_600_000

function codConfirmToken(orderId: string, secret: string, now = new Date()): string {
  return signOrderToken(PURPOSE, orderId, secret, COD_LINK_TTL_MS, now)
}

/** `/cod/<token>` on the store's own domain: the confirm / cancel page. */
const codConfirmPath = (token: string): string => `/cod/${token}`

function codConfirmUrl(orderId: string, secret: string, base: string, now = new Date()) {
  return `${base.replace(/\/$/, '')}${codConfirmPath(codConfirmToken(orderId, secret, now))}`
}

/** Waiting for an answer: a link was sent, or the deadline passed with no reply. */
const OPEN: readonly CodVerification[] = ['pending', 'unconfirmed']

async function note(ctx: StoreContext, orderId: string, body: string) {
  await ctx.tx.insert(orderNote).values({ storeId: ctx.storeId, orderId, body, author: null })
}

/**
 * Called when a COD order is created and the store wants it confirmed: marks it pending and
 * writes `order.cod_confirm_requested`, which the relay turns into the `cod_confirm` message.
 */
export async function requestCodConfirmation(ctx: StoreContext, orderId: string, now = new Date()) {
  await ctx.tx
    .update(order)
    .set({ codVerification: 'pending', codVerifyRequestedAt: now })
    .where(eq(order.id, orderId))
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.cod_confirm_requested', { orderId })
}

export type CodConfirmView = {
  orderNumber: number
  totalPaise: number
  items: number
  status: CodVerification | null
  /** The order is still live and nothing has shipped, so the shopper may cancel it. */
  canCancel: boolean
}

function verifiedOrderId(token: string, secret: string, now: Date): string | null {
  const v = verifyOrderToken(PURPOSE, token, secret, now)
  return v.ok ? v.orderId : null
}

/** What the link page shows; null for a bad or expired link. Opening it changes nothing. */
export async function codConfirmView(
  ctx: StoreContext,
  token: string,
  secret: string,
  now = new Date(),
): Promise<CodConfirmView | null> {
  const orderId = verifiedOrderId(token, secret, now)
  if (!orderId) return null
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId))
  if (o?.paymentMethod !== 'cod') return null
  const [count] = await ctx.tx
    .select({ n: sql<number>`coalesce(sum(${orderLine.quantity}), 0)::int` })
    .from(orderLine)
    .where(eq(orderLine.orderId, o.id))
  return {
    orderNumber: o.number,
    totalPaise: o.totalPaise,
    items: Number(count?.n ?? 0),
    status: o.codVerification,
    canCancel: o.status === 'open' && o.fulfillmentStatus === 'unfulfilled',
  }
}

export type CodAnswerResult =
  | { ok: true; status: 'confirmed' | 'cancelled' }
  | { ok: false; reason: 'invalid' | 'shipped' }

/**
 * The shopper's answer from the link page. Confirming clears the "unconfirmed" flag;
 * cancelling cancels the order (stock goes back) unless something already shipped. A second
 * answer returns where it stands without changing anything.
 */
export async function answerCodConfirmation(
  ctx: StoreContext,
  token: string,
  secret: string,
  answer: 'confirm' | 'cancel',
  now = new Date(),
): Promise<CodAnswerResult> {
  const orderId = verifiedOrderId(token, secret, now)
  if (!orderId) return { ok: false, reason: 'invalid' }
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId)).for('update')
  if (o?.paymentMethod !== 'cod') return { ok: false, reason: 'invalid' }
  if (o.codVerification === 'confirmed' || o.codVerification === 'cancelled') {
    return { ok: true, status: o.codVerification }
  }
  if (o.status === 'cancelled') return { ok: true, status: 'cancelled' }
  const tags = o.tags.filter((t) => t !== COD_RTO_TAGS.unconfirmed)
  if (answer === 'confirm') {
    await ctx.tx
      .update(order)
      .set({ codVerification: 'confirmed', codVerifiedAt: now, tags })
      .where(eq(order.id, o.id))
    await note(ctx, o.id, 'The customer confirmed this cash on delivery order from the link.')
    return { ok: true, status: 'confirmed' }
  }
  if (o.fulfillmentStatus !== 'unfulfilled' || o.status !== 'open') {
    return { ok: false, reason: 'shipped' }
  }
  await ctx.tx
    .update(order)
    .set({ codVerification: 'cancelled', codVerifiedAt: now, tags })
    .where(eq(order.id, o.id))
  await cancelOrder(ctx, o.id)
  await note(ctx, o.id, 'The customer cancelled this cash on delivery order from the link.')
  return { ok: true, status: 'cancelled' }
}

/** The order page's "Confirmed by phone": the merchant called and the shopper said yes. */
export async function markCodConfirmed(ctx: StoreContext, orderId: string, by: string | null) {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId)).for('update')
  if (o?.paymentMethod !== 'cod') return null
  await ctx.tx
    .update(order)
    .set({
      codVerification: 'confirmed',
      codVerifiedAt: new Date(),
      tags: o.tags.filter((t) => t !== COD_RTO_TAGS.unconfirmed),
    })
    .where(eq(order.id, o.id))
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId: o.id,
    body: 'Cash on delivery confirmed with the customer by phone.',
    author: by,
  })
  return { status: 'confirmed' as const }
}

export type CodSweepResult = { flagged: number; cancelled: number }

/**
 * One store's tick: orders with no answer past `flagAfterHours` get the `cod-unconfirmed`
 * tag and a note; with auto-cancel on, those past `autoCancelAfterHours` that have not
 * shipped are cancelled. Each order is changed under its row lock, so overlapping ticks
 * never cancel twice.
 */
export async function runCodConfirmationSweep(
  db: Db,
  storeId: string,
  now = new Date(),
): Promise<CodSweepResult> {
  return withStore(db, storeId, async (tx) => {
    const ctx: StoreContext = { storeId, tx }
    const out: CodSweepResult = { flagged: 0, cancelled: 0 }
    const { installed, settings } = await codRtoState(tx, storeId)
    if (!installed || !settings.verification.enabled) return out
    const v = settings.verification
    const flagBefore = new Date(now.getTime() - v.flagAfterHours * HOUR_MS)
    const due = await tx
      .select()
      .from(order)
      .where(
        and(
          inArray(order.codVerification, [...OPEN]),
          eq(order.status, 'open'),
          lte(order.codVerifyRequestedAt, flagBefore),
        ),
      )
      .for('update', { skipLocked: true })
    const cancelBefore = now.getTime() - v.autoCancelAfterHours * HOUR_MS
    for (const o of due) {
      const at = o.codVerifyRequestedAt?.getTime() ?? now.getTime()
      if (v.autoCancel && at <= cancelBefore && o.fulfillmentStatus === 'unfulfilled') {
        await tx
          .update(order)
          .set({ codVerification: 'cancelled', codVerifiedAt: now })
          .where(eq(order.id, o.id))
        await cancelOrder(ctx, o.id)
        await note(
          ctx,
          o.id,
          `Cancelled automatically: the customer did not confirm this cash on delivery order within ${v.autoCancelAfterHours} hours.`,
        )
        out.cancelled += 1
        continue
      }
      if (o.codVerification !== 'pending') continue
      await tx
        .update(order)
        .set({
          codVerification: 'unconfirmed',
          codVerifiedAt: now,
          tags: [...o.tags.filter((t) => t !== COD_RTO_TAGS.unconfirmed), COD_RTO_TAGS.unconfirmed],
        })
        .where(eq(order.id, o.id))
      await note(
        ctx,
        o.id,
        `No answer to the cash on delivery confirmation after ${v.flagAfterHours} hours. Call the customer before you ship.`,
      )
      out.flagged += 1
    }
    return out
  })
}

/**
 * Where an order message goes. Every template but `cod_confirm` keeps the store's channels.
 * For `cod_confirm`: the link, and WhatsApp when the store has a phone channel and the order
 * a phone, email otherwise. Null when the order no longer waits for an answer, so a late or
 * repeated job sends nothing.
 */
export async function codConfirmDelivery(
  ctx: StoreContext,
  message: { orderId: string; template: TemplateId },
  input: {
    channels: NotificationChannel[]
    to: Recipient
    storefrontUrl: string | undefined
    secret: string
  },
): Promise<{ actionUrl: string | undefined; channels: NotificationChannel[] } | null> {
  if (message.template !== 'cod_confirm') return { actionUrl: undefined, channels: input.channels }
  const [o] = await ctx.tx
    .select({ status: order.status, verification: order.codVerification })
    .from(order)
    .where(eq(order.id, message.orderId))
  if (o?.status !== 'open' || o.verification !== 'pending') return null
  const phone = input.to.phone ? input.channels.filter((c) => c.requires === 'phone') : []
  return {
    actionUrl: input.storefrontUrl
      ? codConfirmUrl(message.orderId, input.secret, input.storefrontUrl)
      : undefined,
    channels: phone.length > 0 ? phone : input.channels.filter((c) => c.requires === 'email'),
  }
}
