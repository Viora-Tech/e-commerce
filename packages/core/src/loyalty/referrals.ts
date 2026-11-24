/** SOURCE OF TRUTH: loyalty referrals — WHAT: a friend arriving with a member's code (fraud checks: self-referral by customer, email, phone, address or device, an existing customer, the member's limit, one referral per new customer), the friend's reward (a one-use code at once, or points on their first delivered order), the referrer's reward once the friend's order is delivered and past the return window, and the tags / WHY: referral rewards are money; each check refuses before anything is given, and the unique friend index makes a leaked code work once per new customer */
import { customer, loyaltyEntry, loyaltyMember, loyaltyReferral, order } from '@commerce/db'
import { aliasedTable, and, desc, eq, lte, ne, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { creditDueEntry, orderPointsBase } from './earn'
import { canUseProgram, ensureMember, memberByReferralCode } from './member'
import { grantFreeReward } from './redeem'
import type { LoyaltySettings, ReferralReward } from './settings'
import { pointsHoldMs } from './state'

export type ReferralRow = typeof loyaltyReferral.$inferSelect

export type ReferralRejectReason =
  | 'self'
  | 'same_email'
  | 'same_phone'
  | 'same_address'
  | 'same_device'
  | 'existing_customer'
  | 'limit'
  | 'not_eligible'

/** `asha.k+promo@gmail.com` and `ashak@gmail.com` are one inbox. Pure. */
export function inboxOf(email: string | null | undefined): string {
  const e = (email ?? '').trim().toLowerCase()
  const at = e.lastIndexOf('@')
  if (at < 1) return e
  let local = e.slice(0, at).split('+')[0] ?? ''
  const domain = e.slice(at + 1)
  if (domain === 'gmail.com' || domain === 'googlemail.com') local = local.replace(/\./g, '')
  return `${local}@${domain === 'googlemail.com' ? 'gmail.com' : domain}`
}

/** An address as one comparable string (first line and PIN code, letters and digits only). Pure. */
export function addressKey(
  a: { line1?: string | null; pincode?: string | null } | null | undefined,
): string {
  if (!a?.line1 || !a.pincode) return ''
  return `${a.line1}|${a.pincode}`.toLowerCase().replace(/[^a-z0-9|]/g, '')
}

async function person(ctx: StoreContext, customerId: string) {
  const [c] = await ctx.tx
    .select({
      id: customer.id,
      email: customer.email,
      phoneIndex: customer.phoneIndex,
      address: customer.defaultAddress,
      tags: customer.tags,
    })
    .from(customer)
    .where(eq(customer.id, customerId))
  return c ?? null
}

async function addTag(ctx: StoreContext, customerId: string, tag: string, now: Date) {
  if (!tag) return
  await ctx.tx
    .update(customer)
    .set({ tags: sql`array_append(${customer.tags}, ${tag})`, updatedAt: now })
    .where(and(eq(customer.id, customerId), sql`not (${tag} = any(${customer.tags}))`))
}

/** A referral reward that is a code: % or ₹ off the order, one use, `days` long. */
function codeOffer(r: ReferralReward) {
  return r.kind === 'percent'
    ? { type: 'percent_off' as const, value: r.value * 100 }
    : { type: 'amount_off' as const, value: r.value }
}

/**
 * A friend signed up or checked out with a member's code. Runs the fraud checks; a failed
 * check is kept as a `rejected` referral with its reason (staff see it) and gives nothing. A
 * friend already referred gets their existing referral back. Returns the referral, or null when
 * referrals are off or the code is unknown.
 */
export async function attachReferral(
  ctx: StoreContext,
  input: { friendId: string; code: string; deviceId?: string | null | undefined },
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<ReferralRow | null> {
  const cfg = settings.referrals
  if (!cfg.enabled) return null
  const referrer = await memberByReferralCode(ctx, input.code)
  if (!referrer) return null
  const [existing] = await ctx.tx
    .select()
    .from(loyaltyReferral)
    .where(eq(loyaltyReferral.friendId, input.friendId))
  if (existing) return existing
  const reason = await rejectReason(ctx, referrer.customerId, input, settings)
  const [row] = await ctx.tx
    .insert(loyaltyReferral)
    .values({
      storeId: ctx.storeId,
      referrerId: referrer.customerId,
      friendId: input.friendId,
      code: referrer.referralCode,
      status: reason ? 'rejected' : 'pending',
      rejectReason: reason,
      deviceId: input.deviceId ?? null,
      createdAt: now,
    })
    .onConflictDoNothing()
    .returning()
  if (!row) {
    const [again] = await ctx.tx
      .select()
      .from(loyaltyReferral)
      .where(eq(loyaltyReferral.friendId, input.friendId))
    return again ?? null
  }
  if (reason) return row
  const friend = await ensureMember(ctx, input.friendId, now)
  await ctx.tx
    .update(loyaltyMember)
    .set({ referredById: referrer.customerId })
    .where(eq(loyaltyMember.id, friend.id))
  await addTag(ctx, input.friendId, cfg.friendTag, now)
  if (cfg.friendReward.kind === 'points') return row
  const code = await grantFreeReward(
    ctx,
    {
      customerId: input.friendId,
      title: 'Welcome reward',
      offer: codeOffer(cfg.friendReward),
      days: cfg.codeDays,
      via: 'referral',
    },
    now,
  )
  const [updated] = await ctx.tx
    .update(loyaltyReferral)
    .set({ friendRedemptionId: code.id })
    .where(eq(loyaltyReferral.id, row.id))
    .returning()
  return updated ?? row
}

async function rejectReason(
  ctx: StoreContext,
  referrerId: string,
  input: { friendId: string; deviceId?: string | null | undefined },
  settings: LoyaltySettings,
): Promise<ReferralRejectReason | null> {
  if (referrerId === input.friendId) return 'self'
  const [a, b] = await Promise.all([person(ctx, referrerId), person(ctx, input.friendId)])
  if (!a || !b) return 'not_eligible'
  if (a.email && b.email && inboxOf(a.email) === inboxOf(b.email)) return 'same_email'
  if (a.phoneIndex && a.phoneIndex === b.phoneIndex) return 'same_phone'
  const ak = addressKey(a.address)
  if (ak && ak === addressKey(b.address)) return 'same_address'
  if (input.deviceId) {
    const [seen] = await ctx.tx
      .select({ id: loyaltyReferral.id })
      .from(loyaltyReferral)
      .where(
        and(
          eq(loyaltyReferral.referrerId, referrerId),
          eq(loyaltyReferral.deviceId, input.deviceId),
        ),
      )
      .limit(1)
    if (seen) return 'same_device'
  }
  const [orders] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(order)
    .where(
      and(eq(order.customerId, input.friendId), ne(order.status, 'draft'), eq(order.isTest, false)),
    )
  if ((orders?.n ?? 0) > 0) return 'existing_customer'
  const max = settings.referrals.maxPerMember
  if (max > 0) {
    const [n] = await ctx.tx
      .select({ n: sql<number>`count(*)::int` })
      .from(loyaltyReferral)
      .where(
        and(eq(loyaltyReferral.referrerId, referrerId), ne(loyaltyReferral.status, 'rejected')),
      )
    if ((n?.n ?? 0) >= max) return 'limit'
  }
  const open = await Promise.all([
    canUseProgram(ctx, referrerId, settings),
    canUseProgram(ctx, input.friendId, settings),
  ])
  if (!open[0] || !open[1]) return 'not_eligible'
  return null
}

/**
 * The friend's order was delivered. Their first counted order (paid or COD, not cancelled)
 * moves the referral to `friend_ordered`, to be completed after the return window; points as
 * the friend's reward wait for the same window. Unpaid, cancelled or later orders do nothing.
 */
export async function referralOrderDelivered(
  ctx: StoreContext,
  orderId: string,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<ReferralRow | null> {
  if (!settings.referrals.enabled) return null
  const base = await orderPointsBase(ctx, orderId)
  if (!base?.earns || !base.customerId) return null
  const [ref] = await ctx.tx
    .select()
    .from(loyaltyReferral)
    .where(
      and(eq(loyaltyReferral.friendId, base.customerId), eq(loyaltyReferral.status, 'pending')),
    )
    .for('update')
  if (!ref) return null
  const availableAt = new Date(now.getTime() + (await pointsHoldMs(ctx.tx, ctx.storeId)))
  const cfg = settings.referrals
  if (cfg.friendReward.kind === 'points') {
    await ctx.tx
      .insert(loyaltyEntry)
      .values({
        storeId: ctx.storeId,
        customerId: base.customerId,
        source: 'referral',
        status: 'pending',
        points: cfg.friendReward.value,
        orderId,
        referralId: ref.id,
        earnKey: 'referral_friend',
        reason: 'Welcome points for joining with a friend’s code',
        availableAt,
        createdAt: now,
      })
      .onConflictDoNothing()
  }
  if (cfg.orderTag) {
    await ctx.tx
      .update(order)
      .set({ tags: sql`array_append(${order.tags}, ${cfg.orderTag})` })
      .where(and(eq(order.id, orderId), sql`not (${cfg.orderTag} = any(${order.tags}))`))
  }
  const [row] = await ctx.tx
    .update(loyaltyReferral)
    .set({ status: 'friend_ordered', friendOrderId: orderId, availableAt })
    .where(eq(loyaltyReferral.id, ref.id))
    .returning()
  return row ?? null
}

/**
 * Referrals whose hold is over: the friend's order must still earn (not refunded in full,
 * cancelled or returned; else `rejected`), then the referrer gets their reward (points, or a
 * one-use code) and tag. Each referral locked, so a rerun gives nothing twice. Returns how many
 * completed.
 */
export async function completeDueReferrals(
  ctx: StoreContext,
  settings: LoyaltySettings,
  now: Date = new Date(),
  limit = 100,
): Promise<number> {
  const due = await ctx.tx
    .select({ id: loyaltyReferral.id })
    .from(loyaltyReferral)
    .where(and(eq(loyaltyReferral.status, 'friend_ordered'), lte(loyaltyReferral.availableAt, now)))
    .limit(limit)
  let done = 0
  const cfg = settings.referrals
  for (const { id } of due) {
    const [ref] = await ctx.tx
      .select()
      .from(loyaltyReferral)
      .where(eq(loyaltyReferral.id, id))
      .for('update')
    if (ref?.status !== 'friend_ordered') continue
    const base = ref.friendOrderId ? await orderPointsBase(ctx, ref.friendOrderId) : null
    if (!base?.earns || base.basePaise <= 0) {
      await ctx.tx
        .update(loyaltyReferral)
        .set({ status: 'rejected', rejectReason: 'order_not_kept' })
        .where(eq(loyaltyReferral.id, ref.id))
      continue
    }
    let referrerRedemptionId: string | null = null
    if (cfg.referrerReward.kind === 'points') {
      const [entry] = await ctx.tx
        .insert(loyaltyEntry)
        .values({
          storeId: ctx.storeId,
          customerId: ref.referrerId,
          source: 'referral',
          status: 'pending',
          points: cfg.referrerReward.value,
          referralId: ref.id,
          earnKey: `referral:${ref.id}`,
          reason: 'Points for referring a friend',
          availableAt: now,
          createdAt: now,
        })
        .onConflictDoNothing()
        .returning({ id: loyaltyEntry.id })
      if (entry) await creditDueEntry(ctx, entry.id, settings, now)
    } else {
      const code = await grantFreeReward(
        ctx,
        {
          customerId: ref.referrerId,
          title: 'Thanks for referring a friend',
          offer: codeOffer(cfg.referrerReward),
          days: cfg.codeDays,
          via: 'referral',
        },
        now,
      )
      referrerRedemptionId = code.id
    }
    await addTag(ctx, ref.referrerId, cfg.referrerTag, now)
    await ctx.tx
      .update(loyaltyReferral)
      .set({ status: 'completed', completedAt: now, referrerRedemptionId })
      .where(eq(loyaltyReferral.id, ref.id))
    done += 1
  }
  return done
}

/** A member's referral code and their referrals, newest first (for the storefront and admin). */
export async function referralSummary(
  ctx: StoreContext,
  customerId: string,
  now: Date = new Date(),
) {
  const member = await ensureMember(ctx, customerId, now)
  const rows = await ctx.tx
    .select({
      id: loyaltyReferral.id,
      friendName: customer.name,
      status: loyaltyReferral.status,
      rejectReason: loyaltyReferral.rejectReason,
      createdAt: loyaltyReferral.createdAt,
      completedAt: loyaltyReferral.completedAt,
    })
    .from(loyaltyReferral)
    .innerJoin(customer, eq(customer.id, loyaltyReferral.friendId))
    .where(eq(loyaltyReferral.referrerId, customerId))
    .orderBy(desc(loyaltyReferral.createdAt))
    .limit(100)
  return {
    code: member.referralCode,
    /** The storefront link; the storefront keeps `ref` in a cookie until sign-up or checkout. */
    path: `/?ref=${member.referralCode}`,
    completed: rows.filter((r) => r.status === 'completed').length,
    referrals: rows,
  }
}

/** The store's referrals newest first (rejected ones with their reason), for the admin. */
export async function listReferrals(
  ctx: StoreContext,
  input: {
    status?: ReferralRow['status'] | undefined
    page?: number | undefined
    perPage?: number | undefined
  },
) {
  const page = Math.max(1, input.page ?? 1)
  const perPage = Math.min(100, Math.max(1, input.perPage ?? 25))
  const friend = aliasedTable(customer, 'friend')
  const where = input.status ? eq(loyaltyReferral.status, input.status) : undefined
  const rows = await ctx.tx
    .select({
      referral: loyaltyReferral,
      referrerName: customer.name,
      referrerEmail: customer.email,
      friendName: friend.name,
      friendEmail: friend.email,
    })
    .from(loyaltyReferral)
    .innerJoin(customer, eq(customer.id, loyaltyReferral.referrerId))
    .innerJoin(friend, eq(friend.id, loyaltyReferral.friendId))
    .where(where)
    .orderBy(desc(loyaltyReferral.createdAt), desc(loyaltyReferral.id))
    .limit(perPage)
    .offset((page - 1) * perPage)
  const [n] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(loyaltyReferral)
    .where(where)
  return {
    rows: rows.map((r) => ({
      ...r.referral,
      referrerName: r.referrerName,
      referrerEmail: r.referrerEmail,
      friendName: r.friendName,
      friendEmail: r.friendEmail,
    })),
    total: n?.n ?? 0,
  }
}
