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
  createdAt: Date
}

/** A customer's balance (0 with no account yet) and their newest ledger entries. */
export async function storeCreditOf(
  ctx: StoreContext,
  customerId: string,
  limit = 50,
): Promise<{ balancePaise: number; entries: StoreCreditEntryView[] }> {
  const [account] = await ctx.tx
    .select({ balancePaise: storeCreditAccount.balancePaise })
    .from(storeCreditAccount)
    .where(eq(storeCreditAccount.customerId, customerId))
  const entries = await ctx.tx
    .select({
      id: storeCreditEntry.id,
      amountPaise: storeCreditEntry.amountPaise,
      balanceAfterPaise: storeCreditEntry.balanceAfterPaise,
      kind: storeCreditEntry.kind,
      reason: storeCreditEntry.reason,
      staffEmail: storeCreditEntry.staffEmail,
      orderId: storeCreditEntry.orderId,
      createdAt: storeCreditEntry.createdAt,
    })
    .from(storeCreditEntry)
    .where(eq(storeCreditEntry.customerId, customerId))
    .orderBy(desc(storeCreditEntry.createdAt), desc(storeCreditEntry.id))
    .limit(limit)
  return { balancePaise: account?.balancePaise ?? 0, entries }
}

/**
 * Credits (positive) or debits (negative) a customer's balance and writes the ledger line, in
 * the caller's transaction. The account row is locked first, so two debits never both pass on
 * the same money; a debit larger than the balance throws `insufficient` and changes nothing.
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
  },
): Promise<{ balancePaise: number; entryId: string }> {
  const reason = input.reason.trim()
  if (!Number.isInteger(input.amountPaise) || input.amountPaise === 0) {
    throw new StoreCreditError('invalid', 'Enter an amount', ctx.storeId)
  }
  if (!reason) throw new StoreCreditError('invalid', 'Give a reason', ctx.storeId)
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
  const next = account.balancePaise + input.amountPaise
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

/** A refund to store credit: back onto the customer's balance. False when the order has none. */
export async function refundToStoreCredit(
  ctx: StoreContext,
  input: {
    orderId: string
    amountPaise: number
    staffEmail?: string | null | undefined
  },
): Promise<boolean> {
  const [o] = await ctx.tx
    .select({ id: order.id, number: order.number, customerId: order.customerId })
    .from(order)
    .where(eq(order.id, input.orderId))
  if (!o?.customerId) return false
  await changeStoreCredit(ctx, {
    customerId: o.customerId,
    amountPaise: input.amountPaise,
    kind: 'refund',
    reason: `Refund for order #${o.number}`,
    orderId: o.id,
    staff: input.staffEmail ? { email: input.staffEmail } : null,
  })
  return true
}
