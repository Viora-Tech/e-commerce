/** SOURCE OF TRUTH: loyalty members — WHAT: the one `loyalty_member` row per customer in the program (made on first need with a random referral code), locking it before any points change, and whether the customer may use the program (excluded tags, paused program) / WHY: the member row lock serialises every points change that is not on the store credit balance, and every earn and redeem asks the same access question */
import { randomBytes } from 'node:crypto'
import { customer, loyaltyMember } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { type LoyaltySettings, programOpenTo } from './settings'

export type MemberRow = typeof loyaltyMember.$inferSelect

/** No 0/O, 1/I/L: codes are read aloud and typed from a phone. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** A random 8-character referral code. */
export function newReferralCode(): string {
  const bytes = randomBytes(8)
  let out = ''
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length]
  return out
}

/** The customer's member row, made (joined now) when missing. */
export async function ensureMember(
  ctx: StoreContext,
  customerId: string,
  now: Date = new Date(),
): Promise<MemberRow> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const [found] = await ctx.tx
      .select()
      .from(loyaltyMember)
      .where(eq(loyaltyMember.customerId, customerId))
    if (found) return found
    // A clash on the code (or a parallel insert for the customer) inserts nothing; look again.
    await ctx.tx
      .insert(loyaltyMember)
      .values({
        storeId: ctx.storeId,
        customerId,
        referralCode: newReferralCode(),
        joinedAt: now,
        createdAt: now,
      })
      .onConflictDoNothing()
  }
  throw new Error('Could not make a loyalty member row')
}

/** The member row, locked for this transaction (made first when missing). */
export async function lockMember(
  ctx: StoreContext,
  customerId: string,
  now: Date = new Date(),
): Promise<MemberRow> {
  await ensureMember(ctx, customerId, now)
  const [row] = await ctx.tx
    .select()
    .from(loyaltyMember)
    .where(eq(loyaltyMember.customerId, customerId))
    .for('update')
  if (!row) throw new Error('Loyalty member row vanished')
  return row
}

/** The member row by referral code (any case), or null. */
export async function memberByReferralCode(
  ctx: StoreContext,
  code: string,
): Promise<MemberRow | null> {
  const clean = code.trim().toUpperCase()
  if (!clean) return null
  const [row] = await ctx.tx
    .select()
    .from(loyaltyMember)
    .where(and(eq(loyaltyMember.storeId, ctx.storeId), eq(loyaltyMember.referralCode, clean)))
  return row ?? null
}

/**
 * Whether this customer may earn and redeem: an existing, not erased or merged record, without
 * an excluded tag, and a test account while the program is paused.
 */
export async function canUseProgram(
  ctx: StoreContext,
  customerId: string,
  settings: LoyaltySettings,
): Promise<boolean> {
  const [c] = await ctx.tx
    .select({
      email: customer.email,
      tags: customer.tags,
      anonymisedAt: customer.anonymisedAt,
      mergedIntoId: customer.mergedIntoId,
    })
    .from(customer)
    .where(eq(customer.id, customerId))
  if (!c || c.anonymisedAt || c.mergedIntoId) return false
  return programOpenTo(settings, c)
}
