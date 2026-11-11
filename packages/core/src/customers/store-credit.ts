/** SOURCE OF TRUTH: store credit balances — WHAT: a customer's balance and its ledger, and every change to it (staff add/remove, paying an order, a refund to store credit) / WHY: store credit is money the shopper holds with the store, not a gift card code, so it lives on the customer with a line per change that says why, who and for which order */
import {
  customer,
  order,
  type STORE_CREDIT_KINDS,
  storeCreditAccount,
  storeCreditEntry,
} from '@commerce/db'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { createCustomer } from './create'
import {
  expireDueStoreCredit,
  spendableStoreCredit,
  storeCreditLastDay,
  storeCreditTimeZone,
} from './store-credit-expiry'

export type StoreCreditKind = (typeof STORE_CREDIT_KINDS)[number]

/** The most a balance may hold, as for a gift card: ₹2,00,000. */
const STORE_CREDIT_MAX_PAISE = 20_000_000

export class StoreCreditError extends CommerceError {
  constructor(
    readonly reason: 'not_found' | 'invalid' | 'insufficient',
    message: string,
    storeId?: string,
  ) {
    super(`STORE_CREDIT_${reason.toUpperCase()}`, message, { storeId })
  }
}

export type StoreCreditEntryView = {
  id: string
  amountPaise: number
  balanceAfterPaise: number
  kind: StoreCreditKind
  reason: string
  staffEmail: string | null
  orderId: string | null
  /** A credit's last day (`YYYY-MM-DD`, store time); null never expires. */
  expiresOn: string | null
  createdAt: Date
}

/**
 * A customer's balance (0 with no account yet; any credit past its expiry date already left
 * out) and their newest ledger entries.
 */
export async function storeCreditOf(
  ctx: StoreContext,
  customerId: string,
  limit = 50,
): Promise<{ balancePaise: number; entries: StoreCreditEntryView[] }> {
  const balancePaise = await spendableStoreCredit(ctx, customerId)
  const timeZone = await storeCreditTimeZone(ctx)
  const rows = await ctx.tx
    .select({
      id: storeCreditEntry.id,
      amountPaise: storeCreditEntry.amountPaise,
      balanceAfterPaise: storeCreditEntry.balanceAfterPaise,
      kind: storeCreditEntry.kind,
      reason: storeCreditEntry.reason,
      staffEmail: storeCreditEntry.staffEmail,
      orderId: storeCreditEntry.orderId,
      expiresAt: storeCreditEntry.expiresAt,
      createdAt: storeCreditEntry.createdAt,
    })
    .from(storeCreditEntry)
    .where(eq(storeCreditEntry.customerId, customerId))
    .orderBy(desc(storeCreditEntry.createdAt), desc(storeCreditEntry.id))
    .limit(limit)
  const entries = rows.map(({ expiresAt, ...e }) => ({
    ...e,
    expiresOn: expiresAt ? storeCreditLastDay(expiresAt, timeZone) : null,
  }))
  return { balancePaise, entries }
}

/**
 * Credits (positive) or debits (negative) a customer's balance and writes the ledger line, in
 * the caller's transaction. The account row is locked first, so two debits never both pass on
 * the same money; a debit larger than the balance throws `insufficient` and changes nothing.
 * Any credit past its expiry date leaves the balance first (`expireDueStoreCredit`), so expired
 * money is never spent. A credit may carry `expiresAt` (staff's choice; null never expires).
 */
export async function changeStoreCredit(
  ctx: StoreContext,
  input: {
    customerId: string
    amountPaise: number
    kind: StoreCreditKind
    reason: string
    /** The staff member (auth user id and email); left out for a change the system made. */
    staff?:
      | { userId?: string | null | undefined; email?: string | null | undefined }
      | null
      | undefined
    orderId?: string | null | undefined
    /** When what is left of this credit runs out; only on a credit, and in the future. */
    expiresAt?: Date | null | undefined
    /** The old store-credit gift card this credit was moved from (once per card). */
    giftCardId?: string | null | undefined
  },
  now: Date = new Date(),
): Promise<{ balancePaise: number; entryId: string }> {
  const reason = input.reason.trim()
  if (!Number.isInteger(input.amountPaise) || input.amountPaise === 0) {
    throw new StoreCreditError('invalid', 'Enter an amount', ctx.storeId)
  }
  if (!reason) throw new StoreCreditError('invalid', 'Give a reason', ctx.storeId)
  const expiresAt = input.expiresAt ?? null
  if (expiresAt && input.amountPaise < 0) {
    throw new StoreCreditError('invalid', 'Only added credit can have an expiry date', ctx.storeId)
  }
  if (expiresAt && expiresAt.getTime() <= now.getTime()) {
    throw new StoreCreditError('invalid', 'Pick an expiry date in the future', ctx.storeId)
  }
  const [cu] = await ctx.tx
    .select({ id: customer.id })
    .from(customer)
    .where(eq(customer.id, input.customerId))
  if (!cu) throw new StoreCreditError('not_found', 'Customer not found', ctx.storeId)
  // One account per customer, made on the first change.
  await ctx.tx
    .insert(storeCreditAccount)
    .values({ storeId: ctx.storeId, customerId: cu.id })
    .onConflictDoNothing()
  const [account] = await ctx.tx
    .select()
    .from(storeCreditAccount)
    .where(
      and(eq(storeCreditAccount.storeId, ctx.storeId), eq(storeCreditAccount.customerId, cu.id)),
    )
    .for('update')
  if (!account) throw new StoreCreditError('not_found', 'Customer not found', ctx.storeId)
  // Expired credit leaves first, under the same lock (its own `expiry` lines).
  const { balancePaise: before } = await expireDueStoreCredit(ctx, account, now)
  const next = before + input.amountPaise
  if (next < 0) {
    throw new StoreCreditError(
      'insufficient',
      'The store credit balance is too low for that.',
      ctx.storeId,
    )
  }
  if (next > STORE_CREDIT_MAX_PAISE) {
    throw new StoreCreditError('invalid', 'Store credit cannot go above ₹2,00,000.', ctx.storeId)
  }
  await ctx.tx
    .update(storeCreditAccount)
    .set({
      balancePaise: sql`${storeCreditAccount.balancePaise} + ${input.amountPaise}`,
      updatedAt: new Date(),
    })
    .where(eq(storeCreditAccount.id, account.id))
  const [entry] = await ctx.tx
    .insert(storeCreditEntry)
    .values({
      storeId: ctx.storeId,
      customerId: cu.id,
      amountPaise: input.amountPaise,
      balanceAfterPaise: next,
      kind: input.kind,
      reason: reason.slice(0, 200),
      staffUserId: input.staff?.userId ?? null,
      staffEmail: input.staff?.email ?? null,
      orderId: input.orderId ?? null,
      expiresAt,
      giftCardId: input.giftCardId ?? null,
    })
    .returning({ id: storeCreditEntry.id })
  return { balancePaise: next, entryId: entry?.id as string }
}

/**
 * "Collect payment → Store credit": takes `amountPaise` from the order's customer's balance for
 * that order. An order with no customer, or a balance too low, throws and nothing is taken.
 */
export async function payOrderWithStoreCredit(
  ctx: StoreContext,
  input: {
    orderId: string
    amountPaise: number
    staff?:
      | { userId?: string | null | undefined; email?: string | null | undefined }
      | null
      | undefined
  },
): Promise<{ balancePaise: number }> {
  const [o] = await ctx.tx
    .select({ id: order.id, number: order.number, customerId: order.customerId })
    .from(order)
    .where(eq(order.id, input.orderId))
  if (!o?.customerId) {
    throw new StoreCreditError(
      'invalid',
      'This order has no customer, so there is no store credit to take.',
      ctx.storeId,
    )
  }
  const { balancePaise } = await changeStoreCredit(ctx, {
    customerId: o.customerId,
    amountPaise: -input.amountPaise,
    kind: 'payment',
    reason: `Paid order #${o.number}`,
    orderId: o.id,
    staff: input.staff,
  })
  return { balancePaise }
}

/** Said when a refund to store credit has nobody to hold the money. */
const NO_STORE_CREDIT_HOLDER =
  'This order has no customer to hold store credit; refund to the original payment instead.'

/**
 * Whose balance store credit for an order goes to: the order's customer, else the store's
 * customer with the order's email (or, with no email, its phone), else a new customer record
 * made for that email or phone. An order with neither throws `NO_STORE_CREDIT_HOLDER`: store
 * credit lives only on a customer's balance, never as a gift card code.
 */
async function storeCreditHolder(
  ctx: StoreContext,
  orderId: string,
  secret: string | undefined,
): Promise<{ customerId: string; orderNumber: number }> {
  const [o] = await ctx.tx
    .select({
      number: order.number,
      customerId: order.customerId,
      email: order.email,
      phone: order.phone,
    })
    .from(order)
    .where(eq(order.id, orderId))
  if (!o) throw new StoreCreditError('not_found', 'Order not found', ctx.storeId)
  if (o.customerId) return { customerId: o.customerId, orderNumber: o.number }
  const email = o.email?.trim() || null
  const phone = o.phone?.trim() || null
  if ((email || phone) && !secret) {
    throw new StoreCreditError('invalid', 'Store credit could not be given.', ctx.storeId)
  }
  const actor = { type: 'system' as const, label: 'Refund to store credit' }
  // Email first, as the shopper is known by it; a phone only when there is no email.
  for (const contact of [email ? { email } : null, !email && phone ? { phone } : null]) {
    if (!contact) continue
    const made = await createCustomer(ctx, contact, { secret: secret as string, actor })
    if (made.ok) return { customerId: made.id, orderNumber: o.number }
    if (made.reason === 'duplicate') return { customerId: made.existingId, orderNumber: o.number }
  }
  throw new StoreCreditError('invalid', NO_STORE_CREDIT_HOLDER, ctx.storeId)
}

/**
 * A refund (or a return's credit) to store credit: onto the balance of the order's customer,
 * found or made by `storeCreditHolder`. Throws when the order has nobody to hold it.
 */
export async function refundToStoreCredit(
  ctx: StoreContext,
  input: {
    orderId: string
    amountPaise: number
    /** For a customer record made from the order's email or phone (it is stored encrypted). */
    secret?: string | undefined
    staffEmail?: string | null | undefined
    /** The history line; "Refund for order #N" when left out. */
    reason?: string | undefined
  },
): Promise<{ customerId: string; balancePaise: number }> {
  const holder = await storeCreditHolder(ctx, input.orderId, input.secret)
  const { balancePaise } = await changeStoreCredit(ctx, {
    customerId: holder.customerId,
    amountPaise: input.amountPaise,
    kind: 'refund',
    reason: input.reason ?? `Refund for order #${holder.orderNumber}`,
    orderId: input.orderId,
    staff: input.staffEmail ? { email: input.staffEmail } : null,
  })
  return { customerId: holder.customerId, balancePaise }
}

export type ShopperStoreCreditEntry = {
  id: string
  amountPaise: number
  kind: StoreCreditKind
  /** The order it was used on or came from; null for a change the store made by hand. */
  orderNumber: number | null
  /** A credit's last day (`YYYY-MM-DD`, store time); null never expires. */
  expiresOn: string | null
  createdAt: Date
}

/**
 * What the shopper's own account page shows: the balance and the newest changes, with the
 * order each one belongs to. Never the staff member or the reason staff typed (the admin's
 * dialog promises the customer does not see it).
 */
export async function shopperStoreCredit(
  ctx: StoreContext,
  customerId: string,
  limit = 20,
): Promise<{ balancePaise: number; entries: ShopperStoreCreditEntry[] }> {
  const balancePaise = await spendableStoreCredit(ctx, customerId)
  const timeZone = await storeCreditTimeZone(ctx)
  const rows = await ctx.tx
    .select({
      id: storeCreditEntry.id,
      amountPaise: storeCreditEntry.amountPaise,
      kind: storeCreditEntry.kind,
      orderNumber: order.number,
      expiresAt: storeCreditEntry.expiresAt,
      createdAt: storeCreditEntry.createdAt,
    })
    .from(storeCreditEntry)
    .leftJoin(order, eq(order.id, storeCreditEntry.orderId))
    .where(eq(storeCreditEntry.customerId, customerId))
    .orderBy(desc(storeCreditEntry.createdAt), desc(storeCreditEntry.id))
    .limit(limit)
  const entries = rows.map(({ expiresAt, ...e }) => ({
    ...e,
    expiresOn: expiresAt ? storeCreditLastDay(expiresAt, timeZone) : null,
  }))
  return { balancePaise, entries }
}
