/** SOURCE OF TRUTH: spent store credit coming back — WHAT: which credits an order's store credit payment was spent from (with their expiry dates), how a return of it is split so each part keeps its credit's date, and the date the cancel and refund dialogs pre-fill / WHY: credit given back on a cancel or a refund must not quietly turn expiring credit into credit that never expires (owner, 12 Nov 2026): staff choose again, pre-filled with the original date, and with no one to ask the original dates are kept */
import { payment, refund, storeCreditEntry } from '@commerce/db'
import { and, asc, eq, inArray, ne, sum } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { STORE_CREDIT_PROVIDER } from '../payments/split-tender'
import {
  openLots,
  type StoreCreditLedgerLine,
  storeCreditExpiryAt,
  storeCreditLastDay,
  storeCreditTimeZone,
} from './store-credit-expiry'

/** Part of an order's store credit payment: how much, and when the credit it came from expires. */
export type SpentStoreCreditPart = { amountPaise: number; expiresAt: Date | null }

/** One line of credit to give back: its amount and expiry, and whether that date was the original. */
export type StoreCreditReturnPiece = {
  amountPaise: number
  expiresAt: Date | null
  /** The original credit's date (it may have passed already: the credit then expires at once). */
  restoresSpent: boolean
}

/** Whose credit an order spent: the customer on its store credit `payment` ledger lines. */
async function spenderOf(ctx: StoreContext, orderId: string): Promise<string | null> {
  const [row] = await ctx.tx
    .select({ customerId: storeCreditEntry.customerId })
    .from(storeCreditEntry)
    .where(and(eq(storeCreditEntry.orderId, orderId), eq(storeCreditEntry.kind, 'payment')))
    .limit(1)
  return row?.customerId ?? null
}

/**
 * The parts the order's store credit payments were spent from, by replaying the customer's
 * ledger the way spending works (soonest expiry first, never-expiring credit last).
 */
async function spentStoreCreditParts(
  ctx: StoreContext,
  orderId: string,
): Promise<{ customerId: string | null; parts: SpentStoreCreditPart[] }> {
  const customerId = await spenderOf(ctx, orderId)
  if (!customerId) return { customerId: null, parts: [] }
  const lines: (StoreCreditLedgerLine & { orderId: string | null })[] = await ctx.tx
    .select({
      id: storeCreditEntry.id,
      amountPaise: storeCreditEntry.amountPaise,
      kind: storeCreditEntry.kind,
      expiresAt: storeCreditEntry.expiresAt,
      expiredEntryId: storeCreditEntry.expiredEntryId,
      orderId: storeCreditEntry.orderId,
    })
    .from(storeCreditEntry)
    .where(eq(storeCreditEntry.customerId, customerId))
    .orderBy(asc(storeCreditEntry.id))
  const parts: SpentStoreCreditPart[] = []
  openLots(lines, (line, amountPaise, expiresAt) => {
    if (line.kind === 'payment' && line.orderId === orderId) parts.push({ amountPaise, expiresAt })
  })
  return { customerId, parts }
}

/**
 * The date to pre-fill when spent credit comes back: the latest expiry among the parts, or null
 * (never expires) when any part came from credit that never expires. Undefined with no parts.
 */
function originalExpiry(parts: readonly SpentStoreCreditPart[]): Date | null | undefined {
  if (parts.length === 0) return undefined
  if (parts.some((p) => p.expiresAt === null)) return null
  return new Date(Math.max(...parts.map((p) => (p.expiresAt as Date).getTime())))
}

/**
 * Splits `amountPaise` of returned credit over the spent parts, skipping the first
 * `alreadyPaise` (returned before), most generous first: never-expiring parts, then the latest
 * expiry. Parts with the same date merge. Anything beyond the parts never expires.
 */
export function splitReturn(
  parts: readonly SpentStoreCreditPart[],
  amountPaise: number,
  alreadyPaise = 0,
): { amountPaise: number; expiresAt: Date | null }[] {
  const time = (d: Date | null) => (d ? d.getTime() : Number.POSITIVE_INFINITY)
  const ordered = [...parts].sort((a, b) => time(b.expiresAt) - time(a.expiresAt))
  const out: { amountPaise: number; expiresAt: Date | null }[] = []
  let skip = alreadyPaise
  let left = amountPaise
  const push = (amount: number, expiresAt: Date | null) => {
    const same = out.find((o) => time(o.expiresAt) === time(expiresAt))
    if (same) same.amountPaise += amount
    else out.push({ amountPaise: amount, expiresAt })
  }
  for (const part of ordered) {
    if (left <= 0) break
    let available = part.amountPaise
    const skipped = Math.min(skip, available)
    skip -= skipped
    available -= skipped
    if (available <= 0) continue
    const take = Math.min(left, available)
    push(take, part.expiresAt)
    left -= take
  }
  if (left > 0) push(left, null)
  return out
}

/** Spent credit already given back on this order: released holds and refunds of store credit payments. */
async function returnedSpentPaise(ctx: StoreContext, orderId: string): Promise<number> {
  const [released] = await ctx.tx
    .select({ total: sum(storeCreditEntry.amountPaise) })
    .from(storeCreditEntry)
    .where(and(eq(storeCreditEntry.orderId, orderId), eq(storeCreditEntry.kind, 'release')))
  const paid = await ctx.tx
    .select({ id: payment.id })
    .from(payment)
    .where(and(eq(payment.orderId, orderId), eq(payment.provider, STORE_CREDIT_PROVIDER)))
  const ids = paid.map((p) => p.id)
  const [refunded] = ids.length
    ? await ctx.tx
        .select({ total: sum(refund.amountPaise) })
        .from(refund)
        .where(and(inArray(refund.paymentId, ids), ne(refund.status, 'failed')))
    : [{ total: 0 }]
  return Number(released?.total ?? 0) + Number(refunded?.total ?? 0)
}

/**
 * The lines to give spent store credit back with. `expiresOn` is staff's choice in the cancel or
 * refund dialog: a day (`YYYY-MM-DD`, store time), or null for never. Left out (no one to ask: the
 * unpaid-order expiry, an edit), each part keeps the expiry of the credit it was spent from.
 */
export async function spentStoreCreditReturn(
  ctx: StoreContext,
  input: {
    orderId: string
    customerId: string
    amountPaise: number
    expiresOn?: string | null | undefined
  },
): Promise<StoreCreditReturnPiece[]> {
  if (input.expiresOn !== undefined) {
    const expiresAt = input.expiresOn
      ? storeCreditExpiryAt(input.expiresOn, await storeCreditTimeZone(ctx))
      : null
    return [{ amountPaise: input.amountPaise, expiresAt, restoresSpent: false }]
  }
  const spent = await spentStoreCreditParts(ctx, input.orderId)
  // Another customer's credit, or none recorded: it comes back as credit that never expires.
  if (spent.customerId !== input.customerId) {
    return [{ amountPaise: input.amountPaise, expiresAt: null, restoresSpent: false }]
  }
  const already = await returnedSpentPaise(ctx, input.orderId)
  return splitReturn(spent.parts, input.amountPaise, already).map((p) => ({
    ...p,
    restoresSpent: true,
  }))
}

/**
 * For the cancel and refund dialogs: how much store credit the order spent, and the expiry to
 * pre-fill (`YYYY-MM-DD`, the latest date among what it was spent from), or null when any of it
 * never expires.
 */
export async function storeCreditReturnDefault(
  ctx: StoreContext,
  orderId: string,
): Promise<{ spentPaise: number; expiresOn: string | null }> {
  const { parts } = await spentStoreCreditParts(ctx, orderId)
  const spentPaise = parts.reduce((s, p) => s + p.amountPaise, 0)
  const original = originalExpiry(parts)
  return {
    spentPaise,
    expiresOn: original ? storeCreditLastDay(original, await storeCreditTimeZone(ctx)) : null,
  }
}
