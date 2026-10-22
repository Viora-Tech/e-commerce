import { createHash } from 'node:crypto'
import {
  customer,
  giftCard,
  giftCardTransaction,
  notification,
  order,
  orderLine,
  payment,
  store,
} from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type {
  NotificationChannel,
  NotificationRegistry,
  TemplateData,
} from '@commerce/notifications'
import { and, desc, eq, ilike, inArray, isNull, or, type SQL, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { recomputeOrderStatuses } from '../order/recompute'
import { decryptSecret, encryptSecret } from '../secrets'
import { storeNotificationChannels } from '../sender-email/channels'
import { customerInStore } from '../store-scope'
import {
  addMonths,
  dateInZone,
  formatGiftCardCode,
  GIFT_CARD_CUSTOM_CODE_MAX,
  GIFT_CARD_CUSTOM_CODE_MIN,
  GIFT_CARD_MAX_VALUE_PAISE,
  type GiftCardState,
  generateGiftCardCode,
  giftCardState,
  normaliseGiftCardCode,
  parseGiftCardSettings,
} from './client'

/** Payment rows paid from a gift card use this provider id; `provider_payment_id` is the card id. */
export const GIFT_CARD_PROVIDER = 'gift_card'

export type GiftCardErrorReason =
  | 'not_found'
  | 'disabled'
  | 'expired'
  | 'empty'
  | 'invalid'
  | 'code_taken'
  | 'not_allowed'

export class GiftCardError extends CommerceError {
  readonly reason: GiftCardErrorReason
  constructor(reason: GiftCardErrorReason, message: string, storeId?: string) {
    super(`GIFT_CARD_${reason.toUpperCase()}`, message, { storeId })
    this.reason = reason
  }
}

const REASON_MESSAGES: Record<Exclude<GiftCardState, 'active'>, string> = {
  disabled: 'This gift card has been disabled',
  expired: 'This gift card has expired',
  empty: 'This gift card has no balance left',
}

export type GiftCardRow = typeof giftCard.$inferSelect

/**
 * Lookup hash. Generated codes carry 60 bits of randomness, so a plain SHA-256 is enough;
 * the store id is mixed in so the same code in two stores hashes differently.
 */
export function hashGiftCardCode(storeId: string, code: string): string {
  return createHash('sha256')
    .update(`${storeId}:${normaliseGiftCardCode(code)}`)
    .digest('hex')
}

/** Today in the store's time zone, which is when a card's `expires_on` day ends. */
export async function storeToday(ctx: StoreContext): Promise<string> {
  const [s] = await ctx.tx
    .select({ timezone: store.timezone })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  return dateInZone(new Date(), s?.timezone ?? 'Asia/Kolkata')
}

export type IssueGiftCardInput = {
  valuePaise: number
  /** Merchant-chosen code; generated when absent. */
  code?: string | undefined
  expiresOn?: string | null | undefined
  customerId?: string | null | undefined
  recipientEmail?: string | null | undefined
  recipientName?: string | null | undefined
  message?: string | null | undefined
  note?: string | null | undefined
  createdBy?: string | null | undefined
  source?: 'manual' | 'purchase' | undefined
  orderId?: string | null | undefined
  orderLineId?: string | null | undefined
  lineIndex?: number | null | undefined
}

/**
 * Issue a card and write its opening transaction. Returns the code once, in
 * the clear, for the caller to show or send; only its hash and an encrypted
 * copy are stored. Null when the order line already issued this card (the
 * paid-order path is idempotent on `(order_line_id, line_index)`).
 */
export async function issueGiftCard(
  ctx: StoreContext,
  input: IssueGiftCardInput,
  secret: string,
): Promise<{ card: GiftCardRow; code: string } | null> {
  if (
    !Number.isInteger(input.valuePaise) ||
    input.valuePaise <= 0 ||
    input.valuePaise > GIFT_CARD_MAX_VALUE_PAISE
  ) {
    throw new GiftCardError('invalid', 'Enter a gift card value between ₹1 and ₹2,00,000')
  }
  if (input.customerId && !(await customerInStore(ctx.tx, input.customerId))) {
    throw new GiftCardError('invalid', 'Customer not found')
  }
  let code = generateGiftCardCode()
  if (input.code?.trim()) {
    code = normaliseGiftCardCode(input.code)
    if (code.length < GIFT_CARD_CUSTOM_CODE_MIN || code.length > GIFT_CARD_CUSTOM_CODE_MAX) {
      throw new GiftCardError(
        'invalid',
        `Gift card codes are ${GIFT_CARD_CUSTOM_CODE_MIN} to ${GIFT_CARD_CUSTOM_CODE_MAX} letters and digits`,
      )
    }
  }
  const codeHash = hashGiftCardCode(ctx.storeId, code)
  const [taken] = await ctx.tx
    .select({ id: giftCard.id })
    .from(giftCard)
    .where(eq(giftCard.codeHash, codeHash))
  if (taken) throw new GiftCardError('code_taken', 'Another gift card already uses this code')
  if (input.expiresOn && input.expiresOn < (await storeToday(ctx))) {
    throw new GiftCardError('invalid', 'The expiry date is in the past')
  }
  const [card] = await ctx.tx
    .insert(giftCard)
    .values({
      storeId: ctx.storeId,
      codeHash,
      codeCipher: encryptSecret(code, secret),
      lastCharacters: code.slice(-4),
      initialValuePaise: input.valuePaise,
      balancePaise: input.valuePaise,
      expiresOn: input.expiresOn ?? null,
      customerId: input.customerId ?? null,
      recipientEmail: input.recipientEmail?.trim().toLowerCase() || null,
      recipientName: input.recipientName?.trim() || null,
      message: input.message?.trim() || null,
      note: input.note?.trim() || null,
      source: input.source ?? 'manual',
      orderId: input.orderId ?? null,
      orderLineId: input.orderLineId ?? null,
      lineIndex: input.lineIndex ?? null,
      createdBy: input.createdBy ?? null,
    })
    .onConflictDoNothing({
      target: [giftCard.orderLineId, giftCard.lineIndex],
      where: sql`order_line_id is not null`,
    })
    .returning()
  if (!card) return null
  await ctx.tx.insert(giftCardTransaction).values({
    storeId: ctx.storeId,
    giftCardId: card.id,
    kind: 'issue',
    amountPaise: card.initialValuePaise,
    balanceAfterPaise: card.balancePaise,
    orderId: card.orderId,
    author: input.createdBy ?? null,
  })
  return { card, code }
}

export type RedeemableGiftCard = {
  id: string
  lastCharacters: string
  balancePaise: number
  expiresOn: string | null
}

/** Find a card a shopper typed at checkout. Throws a GiftCardError that says why it cannot be used. */
export async function findRedeemableGiftCard(
  ctx: StoreContext,
  rawCode: string,
): Promise<RedeemableGiftCard> {
  const code = normaliseGiftCardCode(rawCode)
  if (code.length < GIFT_CARD_CUSTOM_CODE_MIN) {
    throw new GiftCardError('not_found', 'Enter a valid gift card code', ctx.storeId)
  }
  const [card] = await ctx.tx
    .select()
    .from(giftCard)
    .where(eq(giftCard.codeHash, hashGiftCardCode(ctx.storeId, code)))
  if (!card) throw new GiftCardError('not_found', 'Enter a valid gift card code', ctx.storeId)
  const state = giftCardState(card, await storeToday(ctx))
  if (state !== 'active') throw new GiftCardError(state, REASON_MESSAGES[state], ctx.storeId)
  return {
    id: card.id,
    lastCharacters: card.lastCharacters,
    balancePaise: card.balancePaise,
    expiresOn: card.expiresOn,
  }
}

export type GiftCardRedemption = { paymentId: string; giftCardId: string; amountPaise: number }

/**
 * Pay part or all of an order from gift cards, in the order given. Each card
 * row is locked (`for update`) before its balance is read, so two checkouts
 * spending the same card serialise: the second sees what the first left and
 * can never take the balance below zero (the check constraint backs this up).
 * Every card taken becomes a captured `gift_card` payment on the order.
 */
export async function redeemGiftCards(
  ctx: StoreContext,
  input: { orderId: string; giftCardIds: readonly string[]; amountDuePaise: number },
): Promise<{ redeemedPaise: number; redemptions: GiftCardRedemption[] }> {
  const today = await storeToday(ctx)
  let due = input.amountDuePaise
  const redemptions: GiftCardRedemption[] = []
  for (const id of [...new Set(input.giftCardIds)]) {
    if (due <= 0) break
    const [card] = await ctx.tx.select().from(giftCard).where(eq(giftCard.id, id)).for('update')
    if (!card) throw new GiftCardError('not_found', 'Enter a valid gift card code', ctx.storeId)
    const state = giftCardState(card, today)
    if (state !== 'active') throw new GiftCardError(state, REASON_MESSAGES[state], ctx.storeId)
    const amount = Math.min(card.balancePaise, due)
    const [p] = await ctx.tx
      .insert(payment)
      .values({
        storeId: ctx.storeId,
        orderId: input.orderId,
        provider: GIFT_CARD_PROVIDER,
        providerRef: `gift_card_${card.id}_${input.orderId}`,
        providerPaymentId: card.id,
        status: 'captured',
        amountPaise: amount,
      })
      .returning({ id: payment.id })
    if (!p) throw new Error('payment insert returned nothing')
    const [after] = await ctx.tx
      .update(giftCard)
      .set({ balancePaise: sql`${giftCard.balancePaise} - ${amount}`, updatedAt: new Date() })
      .where(eq(giftCard.id, card.id))
      .returning({ balancePaise: giftCard.balancePaise })
    await ctx.tx.insert(giftCardTransaction).values({
      storeId: ctx.storeId,
      giftCardId: card.id,
      kind: 'debit',
      amountPaise: -amount,
      balanceAfterPaise: after?.balancePaise ?? card.balancePaise - amount,
      orderId: input.orderId,
      paymentId: p.id,
    })
    redemptions.push({ paymentId: p.id, giftCardId: card.id, amountPaise: amount })
    due -= amount
  }
  return { redeemedPaise: input.amountDuePaise - due, redemptions }
}

/** Undo `redeemGiftCards` inside the same checkout (workflow compensation). */
export async function reverseGiftCardRedemptions(
  ctx: StoreContext,
  redemptions: readonly GiftCardRedemption[],
): Promise<void> {
  for (const r of redemptions) {
    await ctx.tx.delete(giftCardTransaction).where(eq(giftCardTransaction.paymentId, r.paymentId))
    await ctx.tx.delete(payment).where(eq(payment.id, r.paymentId))
    await ctx.tx
      .update(giftCard)
      .set({ balancePaise: sql`${giftCard.balancePaise} + ${r.amountPaise}` })
      .where(eq(giftCard.id, r.giftCardId))
  }
}

/**
 * Add money back to a card: a refund of a gift card payment, or a merchant
 * adjustment (which may also be negative). Works on disabled and expired
 * cards too, so a refund is never lost; the balance never goes below zero.
 */
export async function changeGiftCardBalance(
  ctx: StoreContext,
  input: {
    giftCardId: string
    amountPaise: number
    kind: 'refund' | 'adjustment'
    orderId?: string | null | undefined
    paymentId?: string | null | undefined
    note?: string | null | undefined
    author?: string | null | undefined
  },
): Promise<GiftCardRow> {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise === 0) {
    throw new GiftCardError('invalid', 'Enter an amount')
  }
  const [card] = await ctx.tx
    .select()
    .from(giftCard)
    .where(eq(giftCard.id, input.giftCardId))
    .for('update')
  if (!card) throw new GiftCardError('not_found', 'Gift card not found', ctx.storeId)
  const next = card.balancePaise + input.amountPaise
  if (next < 0) throw new GiftCardError('invalid', 'The balance cannot go below zero')
  if (next > GIFT_CARD_MAX_VALUE_PAISE) {
    throw new GiftCardError('invalid', 'The balance cannot go above ₹2,00,000')
  }
  const [updated] = await ctx.tx
    .update(giftCard)
    .set({ balancePaise: next, updatedAt: new Date() })
    .where(eq(giftCard.id, card.id))
    .returning()
  await ctx.tx.insert(giftCardTransaction).values({
    storeId: ctx.storeId,
    giftCardId: card.id,
    kind: input.kind,
    amountPaise: input.amountPaise,
    balanceAfterPaise: next,
    orderId: input.orderId ?? null,
    paymentId: input.paymentId ?? null,
    note: input.note?.trim() || null,
    author: input.author ?? null,
  })
  return updated ?? card
}

export async function setGiftCardDisabled(
  ctx: StoreContext,
  id: string,
  disabled: boolean,
): Promise<GiftCardRow | null> {
  const [row] = await ctx.tx
    .update(giftCard)
    .set({ disabledAt: disabled ? new Date() : null, updatedAt: new Date() })
    .where(eq(giftCard.id, id))
    .returning()
  return row ?? null
}

export async function updateGiftCard(
  ctx: StoreContext,
  id: string,
  patch: {
    expiresOn?: string | null | undefined
    note?: string | null | undefined
    customerId?: string | null | undefined
    recipientEmail?: string | null | undefined
    recipientName?: string | null | undefined
  },
): Promise<GiftCardRow | null> {
  const set: Partial<typeof giftCard.$inferInsert> = { updatedAt: new Date() }
  if (patch.expiresOn !== undefined) set.expiresOn = patch.expiresOn
  if (patch.note !== undefined) set.note = patch.note?.trim() || null
  if (patch.customerId && !(await customerInStore(ctx.tx, patch.customerId))) {
    throw new GiftCardError('invalid', 'Customer not found')
  }
  if (patch.customerId !== undefined) set.customerId = patch.customerId
  if (patch.recipientEmail !== undefined) {
    set.recipientEmail = patch.recipientEmail?.trim().toLowerCase() || null
  }
  if (patch.recipientName !== undefined) set.recipientName = patch.recipientName?.trim() || null
  const [row] = await ctx.tx.update(giftCard).set(set).where(eq(giftCard.id, id)).returning()
  return row ?? null
}

export type GiftCardListFilter = {
  q?: string | undefined
  state?: GiftCardState | undefined
  limit?: number | undefined
  offset?: number | undefined
}

/** SQL for one state, mirroring `giftCardState`. */
function stateWhere(state: GiftCardState, today: string): SQL {
  const live = sql`(${giftCard.expiresOn} is null or ${giftCard.expiresOn} >= ${today}::date)`
  switch (state) {
    case 'disabled':
      return sql`${giftCard.disabledAt} is not null`
    case 'expired':
      return sql`${giftCard.disabledAt} is null and ${giftCard.expiresOn} < ${today}::date`
    case 'empty':
      return sql`${giftCard.disabledAt} is null and ${live} and ${giftCard.balancePaise} = 0`
    case 'active':
      return sql`${giftCard.disabledAt} is null and ${live} and ${giftCard.balancePaise} > 0`
  }
}

const listColumns = {
  id: giftCard.id,
  lastCharacters: giftCard.lastCharacters,
  initialValuePaise: giftCard.initialValuePaise,
  balancePaise: giftCard.balancePaise,
  expiresOn: giftCard.expiresOn,
  disabledAt: giftCard.disabledAt,
  source: giftCard.source,
  recipientEmail: giftCard.recipientEmail,
  recipientName: giftCard.recipientName,
  createdAt: giftCard.createdAt,
  customerId: giftCard.customerId,
  customerName: customer.name,
  customerEmail: customer.email,
  orderId: giftCard.orderId,
}

export async function listGiftCards(ctx: StoreContext, filter: GiftCardListFilter = {}) {
  const today = await storeToday(ctx)
  const q = filter.q?.trim()
  const conds: (SQL | undefined)[] = [
    filter.state ? stateWhere(filter.state, today) : undefined,
    q
      ? or(
          ilike(giftCard.lastCharacters, `%${normaliseGiftCardCode(q).slice(-4) || q}%`),
          ilike(giftCard.recipientEmail, `%${q}%`),
          ilike(giftCard.recipientName, `%${q}%`),
          ilike(customer.email, `%${q}%`),
          ilike(customer.name, `%${q}%`),
        )
      : undefined,
  ]
  const where = and(...conds)
  const rows = await ctx.tx
    .select({ ...listColumns, orderNumber: order.number })
    .from(giftCard)
    .leftJoin(customer, eq(customer.id, giftCard.customerId))
    .leftJoin(order, eq(order.id, giftCard.orderId))
    .where(where)
    .orderBy(desc(giftCard.createdAt))
    .limit(Math.min(filter.limit ?? 50, 200))
    .offset(filter.offset ?? 0)
  const [count] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(giftCard)
    .leftJoin(customer, eq(customer.id, giftCard.customerId))
    .where(where)
  const [totals] = await ctx.tx
    .select({
      outstandingPaise: sql<number>`coalesce(sum(${giftCard.balancePaise}), 0)::int`,
      activeCount: sql<number>`count(*)::int`,
    })
    .from(giftCard)
    .where(stateWhere('active', today))
  return {
    today,
    total: count?.n ?? 0,
    outstandingPaise: totals?.outstandingPaise ?? 0,
    activeCount: totals?.activeCount ?? 0,
    rows: rows.map((r) => ({ ...r, state: giftCardState(r, today) })),
  }
}

/** One card with its customer, the order that sold it, and the full balance history. */
export async function getGiftCard(ctx: StoreContext, id: string) {
  const [row] = await ctx.tx
    .select({
      ...listColumns,
      note: giftCard.note,
      message: giftCard.message,
      deliveredAt: giftCard.deliveredAt,
      createdBy: giftCard.createdBy,
      canResend: sql<boolean>`${giftCard.codeCipher} is not null`,
    })
    .from(giftCard)
    .leftJoin(customer, eq(customer.id, giftCard.customerId))
    .where(eq(giftCard.id, id))
  if (!row) return null
  const today = await storeToday(ctx)
  const transactions = await ctx.tx
    .select({
      id: giftCardTransaction.id,
      kind: giftCardTransaction.kind,
      amountPaise: giftCardTransaction.amountPaise,
      balanceAfterPaise: giftCardTransaction.balanceAfterPaise,
      note: giftCardTransaction.note,
      author: giftCardTransaction.author,
      createdAt: giftCardTransaction.createdAt,
      orderId: giftCardTransaction.orderId,
      orderNumber: order.number,
    })
    .from(giftCardTransaction)
    .leftJoin(order, eq(order.id, giftCardTransaction.orderId))
    .where(eq(giftCardTransaction.giftCardId, id))
    .orderBy(desc(giftCardTransaction.createdAt), desc(giftCardTransaction.id))
  const [sold] = row.orderId
    ? await ctx.tx.select({ number: order.number }).from(order).where(eq(order.id, row.orderId))
    : []
  return {
    ...row,
    orderNumber: sold?.number ?? null,
    today,
    state: giftCardState(row, today),
    transactions,
  }
}

/** Cards a customer holds, for the customer page. */
export async function giftCardsForCustomer(ctx: StoreContext, customerId: string) {
  const today = await storeToday(ctx)
  const rows = await ctx.tx
    .select({
      id: giftCard.id,
      lastCharacters: giftCard.lastCharacters,
      balancePaise: giftCard.balancePaise,
      initialValuePaise: giftCard.initialValuePaise,
      expiresOn: giftCard.expiresOn,
      disabledAt: giftCard.disabledAt,
    })
    .from(giftCard)
    .where(eq(giftCard.customerId, customerId))
    .orderBy(desc(giftCard.createdAt))
  return rows.map((r) => ({ ...r, state: giftCardState(r, today) }))
}

/**
 * Issue the cards a paid order bought: one per unit on every gift card line,
 * to the buyer's email, with the store's default expiry. Idempotent, so every
 * path that marks an order paid can call it. Gift card lines count as
 * fulfilled once issued (they are digital), so an order made only of gift
 * cards derives as fulfilled. Returns the ids issued by this call.
 */
export async function issueGiftCardsForOrder(
  ctx: StoreContext,
  orderId: string,
  secret: string,
): Promise<string[]> {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId))
  if (!o?.checkoutPaidAt || o.status === 'cancelled' || o.status === 'draft') return []
  const lines = await ctx.tx.select().from(orderLine).where(eq(orderLine.orderId, orderId))
  const giftLines = lines.filter((l) => l.giftCard)
  if (giftLines.length === 0) return []
  const [s] = await ctx.tx
    .select({ giftCards: store.giftCards, timezone: store.timezone })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const settings = parseGiftCardSettings(s?.giftCards)
  const today = dateInZone(new Date(), s?.timezone ?? 'Asia/Kolkata')
  const expiresOn = settings.expiryMonths ? addMonths(today, settings.expiryMonths) : null
  const issued: string[] = []
  for (const line of giftLines) {
    for (let i = 0; i < line.quantity; i++) {
      const r = await issueGiftCard(
        ctx,
        {
          valuePaise: line.unitPricePaise,
          source: 'purchase',
          orderId,
          orderLineId: line.id,
          lineIndex: i,
          customerId: o.customerId,
          recipientEmail: o.email,
          expiresOn,
        },
        secret,
      )
      if (r) issued.push(r.card.id)
    }
    if (line.fulfilledQuantity < line.quantity) {
      await ctx.tx
        .update(orderLine)
        .set({ fulfilledQuantity: line.quantity })
        .where(eq(orderLine.id, line.id))
    }
  }
  await recomputeOrderStatuses(ctx, orderId)
  return issued
}

/** Cards of an order still waiting for their email. */
export async function undeliveredGiftCards(ctx: StoreContext, orderId: string): Promise<string[]> {
  const rows = await ctx.tx
    .select({ id: giftCard.id })
    .from(giftCard)
    .where(and(eq(giftCard.orderId, orderId), isNull(giftCard.deliveredAt)))
  return rows.map((r) => r.id)
}

/** Email channels of the store, resolved from its notification settings. */
export async function giftCardChannels(
  ctx: StoreContext,
  registry: NotificationRegistry,
  secret: string,
): Promise<NotificationChannel[]> {
  const channels = await storeNotificationChannels(ctx.tx, ctx.storeId, {
    registry,
    settingsSecret: secret,
  })
  return channels.filter((c) => c.requires === 'email')
}

const longDate = (ymd: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${ymd}T00:00:00Z`))

export type GiftCardDelivery = { channel: string; to: string; ok: boolean; error?: string }

/**
 * Email a card's code to its recipient (or the customer). The code is
 * decrypted only here. Every attempt is logged in `notification`; a success
 * stamps `delivered_at`.
 */
export async function deliverGiftCard(
  ctx: StoreContext,
  giftCardId: string,
  opts: { channels: NotificationChannel[]; secret: string; to?: string | undefined },
): Promise<GiftCardDelivery[]> {
  const [card] = await ctx.tx.select().from(giftCard).where(eq(giftCard.id, giftCardId))
  if (!card) throw new GiftCardError('not_found', 'Gift card not found', ctx.storeId)
  if (!card.codeCipher) {
    throw new GiftCardError('not_allowed', 'This gift card code can no longer be sent')
  }
  const [cu] = card.customerId
    ? await ctx.tx.select().from(customer).where(eq(customer.id, card.customerId))
    : []
  const to = opts.to?.trim().toLowerCase() || card.recipientEmail || cu?.email
  if (!to) return [{ channel: 'email', to: '', ok: false, error: 'No email address to send to' }]
  if (opts.channels.length === 0) {
    return [{ channel: 'email', to, ok: false, error: 'No email channel is enabled' }]
  }
  const [s] = await ctx.tx.select({ name: store.name }).from(store).where(eq(store.id, ctx.storeId))
  const code = decryptSecret(card.codeCipher, opts.secret)
  const data: TemplateData = {
    storeName: s?.name ?? '',
    customerName: card.recipientName || cu?.name || 'there',
    totalLabel: formatMoney(card.balancePaise, 'INR'),
    lines: [],
    paymentMethodLabel: '',
    giftCard: {
      code: formatGiftCardCode(code),
      balanceLabel: formatMoney(card.balancePaise, 'INR'),
      expiresLabel: card.expiresOn ? longDate(card.expiresOn) : undefined,
      message: card.message ?? undefined,
    },
  }
  const results: GiftCardDelivery[] = []
  for (const channel of opts.channels) {
    const r = await channel.send({ to: { email: to }, template: 'gift_card_issued', data })
    await ctx.tx.insert(notification).values({
      storeId: ctx.storeId,
      channel: channel.id,
      template: 'gift_card_issued',
      to,
      status: r.ok ? 'sent' : 'failed',
      providerRef: r.ok ? r.providerRef : null,
      error: r.ok ? null : r.error,
    })
    results.push(
      r.ok
        ? { channel: channel.id, to, ok: true }
        : { channel: channel.id, to, ok: false, error: r.error },
    )
  }
  if (results.some((r) => r.ok)) {
    await ctx.tx.update(giftCard).set({ deliveredAt: new Date() }).where(eq(giftCard.id, card.id))
  }
  return results
}

/**
 * The paid-order hook: issue what the order bought, then email every card
 * that has not gone out yet. Safe to repeat (worker retries).
 */
export async function fulfilGiftCardsForOrder(
  ctx: StoreContext,
  orderId: string,
  opts: { registry: NotificationRegistry; secret: string },
): Promise<{ issued: string[]; deliveries: GiftCardDelivery[] }> {
  const issued = await issueGiftCardsForOrder(ctx, orderId, opts.secret)
  const pending = await undeliveredGiftCards(ctx, orderId)
  if (pending.length === 0) return { issued, deliveries: [] }
  const channels = await giftCardChannels(ctx, opts.registry, opts.secret)
  const deliveries: GiftCardDelivery[] = []
  for (const id of pending) {
    deliveries.push(...(await deliverGiftCard(ctx, id, { channels, secret: opts.secret })))
  }
  return { issued, deliveries }
}

/** Gift card payments on an order that still hold money (for cancel and refund flows). */
export async function giftCardPaymentsFor(ctx: StoreContext, orderIds: readonly string[]) {
  if (orderIds.length === 0) return []
  return ctx.tx
    .select()
    .from(payment)
    .where(and(inArray(payment.orderId, [...orderIds]), eq(payment.provider, GIFT_CARD_PROVIDER)))
}
