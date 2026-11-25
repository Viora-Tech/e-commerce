/** SOURCE OF TRUTH: loyalty earning-rule grants — WHAT: giving a rule's points once per key (`signup`, `newsletter`, `first_order`, `social:<platform>`, `google_review`, `visit:<day>`, `streak:<day>`, `anniversary:<year>`), credited at once or after an order's return window, and the triggers: sign-up, newsletter, a delivered first order, a signed-in visit (daily and streak), a social or Google review click-through, membership anniversaries / WHY: the unique `earn_key` index makes each grant happen once even when a hook or a click runs twice */
import { dayKey } from '@commerce/dates'
import { customer, customerSession, loyaltyEntry, loyaltyMember, order } from '@commerce/db'
import { and, eq, inArray, ne, notExists, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { storeCreditTimeZone } from '../customers/store-credit-expiry'
import { creditDueEntry, orderPointsBase } from './earn'
import { LoyaltyError } from './errors'
import { canUseProgram, ensureMember, lockMember } from './member'
import { type EarnRuleRow, ruleById, ruleByType } from './rules'
import { parseRuleSettings } from './schemas'
import { birthdaysOn, type LoyaltySettings } from './settings'
import { pointsHoldMs } from './state'

type EntryRow = typeof loyaltyEntry.$inferSelect

/**
 * Gives `rule`'s points to the customer once for `earnKey`: a pending entry (unique per key),
 * credited straight away unless `availableAt` is later (an order's return window). Nothing when
 * the rule is off, gives 0, or the customer is outside the program. Returns the new entry, or
 * null when nothing was given (already had it, off, not eligible).
 */
async function grantRule(
  ctx: StoreContext,
  input: {
    customerId: string
    rule: EarnRuleRow | null
    earnKey: string
    reason: string
    orderId?: string | null
    availableAt?: Date
  },
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<EntryRow | null> {
  const { rule } = input
  if (!rule?.enabled || rule.points <= 0) return null
  if (!(await canUseProgram(ctx, input.customerId, settings))) return null
  await ensureMember(ctx, input.customerId, now)
  const availableAt = input.availableAt ?? now
  const [row] = await ctx.tx
    .insert(loyaltyEntry)
    .values({
      storeId: ctx.storeId,
      customerId: input.customerId,
      source: 'rule',
      status: 'pending',
      points: rule.points,
      ruleId: rule.id,
      earnKey: input.earnKey,
      orderId: input.orderId ?? null,
      reason: input.reason.slice(0, 200),
      availableAt,
      createdAt: now,
    })
    .onConflictDoNothing()
    .returning()
  if (!row) return null
  if (availableAt.getTime() <= now.getTime()) await creditDueEntry(ctx, row.id, settings, now)
  return row
}

/**
 * Sign-up points: the shopper made an account (signed in to the storefront at least once).
 * Called by the storefront after sign-in and by the `customer.created` hook.
 */
export async function grantSignupPoints(
  ctx: StoreContext,
  customerId: string,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<EntryRow | null> {
  const [s] = await ctx.tx
    .select({ id: customerSession.id })
    .from(customerSession)
    .where(eq(customerSession.customerId, customerId))
    .limit(1)
  if (!s) return null
  const rule = await ruleByType(ctx, 'signup')
  return grantRule(
    ctx,
    { customerId, rule, earnKey: 'signup', reason: 'Points for signing up' },
    settings,
    now,
  )
}

/** Newsletter points: the customer accepts email marketing (checked on every profile change). */
export async function grantNewsletterPoints(
  ctx: StoreContext,
  customerId: string,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<EntryRow | null> {
  const [c] = await ctx.tx
    .select({ accepts: customer.acceptsMarketing })
    .from(customer)
    .where(eq(customer.id, customerId))
  if (!c?.accepts) return null
  const rule = await ruleByType(ctx, 'newsletter')
  return grantRule(
    ctx,
    { customerId, rule, earnKey: 'newsletter', reason: 'Points for joining the newsletter' },
    settings,
    now,
  )
}

/**
 * First order bonus, on delivery of the customer's first counted order (no earlier order that
 * is not a draft, cancelled or a test), held for the return window like order points.
 */
export async function planFirstOrderBonus(
  ctx: StoreContext,
  orderId: string,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<EntryRow | null> {
  const rule = await ruleByType(ctx, 'first_order')
  if (!rule?.enabled) return null
  const base = await orderPointsBase(ctx, orderId)
  if (!base?.earns || !base.customerId) return null
  const [earlier] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(order)
    .where(
      and(
        eq(order.customerId, base.customerId),
        ne(order.id, orderId),
        sql`${order.status} not in ('draft', 'cancelled')`,
        eq(order.isTest, false),
        sql`${order.placedAt} < ${base.placedAt.toISOString()}::timestamptz`,
      ),
    )
  if ((earlier?.n ?? 0) > 0) return null
  const hold = await pointsHoldMs(ctx.tx, ctx.storeId)
  return grantRule(
    ctx,
    {
      customerId: base.customerId,
      rule,
      earnKey: 'first_order',
      reason: `First order bonus: order #${base.number}`,
      orderId,
      availableAt: new Date(now.getTime() + hold),
    },
    settings,
    now,
  )
}

const DAY_MS = 86_400_000

/**
 * A signed-in shopper loaded the storefront. Counts once per store-time day: the streak goes
 * up after yesterday's visit, else starts again at 1. Gives the daily visit points
 * (`visit:<day>`) and, every `days` in a row, the streak bonus (`streak:<day>`). Returns the
 * streak and what was given.
 */
export async function recordVisit(
  ctx: StoreContext,
  customerId: string,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<{ counted: boolean; streakDays: number; points: number }> {
  if (!(await canUseProgram(ctx, customerId, settings))) {
    return { counted: false, streakDays: 0, points: 0 }
  }
  const timeZone = await storeCreditTimeZone(ctx)
  const today = dayKey(now, timeZone)
  const member = await lockMember(ctx, customerId, now)
  if (member.lastVisitDay === today) {
    return { counted: false, streakDays: member.streakDays, points: 0 }
  }
  const yesterday = dayKey(new Date(now.getTime() - DAY_MS), timeZone)
  const streakDays = member.lastVisitDay === yesterday ? member.streakDays + 1 : 1
  await ctx.tx
    .update(loyaltyMember)
    .set({ lastVisitDay: today, streakDays })
    .where(eq(loyaltyMember.id, member.id))
  let points = 0
  const daily = await grantRule(
    ctx,
    {
      customerId,
      rule: await ruleByType(ctx, 'daily_visit'),
      earnKey: `visit:${today}`,
      reason: 'Daily visit',
    },
    settings,
    now,
  )
  points += daily?.points ?? 0
  const streakRule = await ruleByType(ctx, 'visit_streak')
  if (streakRule) {
    const { days } = parseRuleSettings('visit_streak', streakRule.settings)
    if (streakDays % days === 0) {
      const bonus = await grantRule(
        ctx,
        {
          customerId,
          rule: streakRule,
          earnKey: `streak:${today}`,
          reason: `${streakDays} days in a row`,
        },
        settings,
        now,
      )
      points += bonus?.points ?? 0
    }
  }
  return { counted: true, streakDays, points }
}

/**
 * The shopper clicked through a social follow/join action or "Review us on Google": points
 * once per rule (honour system, credited on the click). Returns the link to open and the
 * points given (0 when already claimed). Refuses a rule that is not one of those, or off.
 */
export async function claimActionRule(
  ctx: StoreContext,
  customerId: string,
  ruleId: string,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<{ url: string; points: number }> {
  const rule = await ruleById(ctx, ruleId)
  if (!rule || (rule.type !== 'social' && rule.type !== 'google_review') || !rule.enabled) {
    throw new LoyaltyError('not_found', 'This way to earn is not on', ctx.storeId)
  }
  const url =
    rule.type === 'social'
      ? parseRuleSettings('social', rule.settings).url
      : parseRuleSettings('google_review', rule.settings).url
  const earnKey = rule.type === 'social' ? `social:${rule.key}` : 'google_review'
  const reason =
    rule.type === 'social' ? `Points for following on ${rule.key}` : 'Points for a Google review'
  const row = await grantRule(ctx, { customerId, rule, earnKey, reason }, settings, now)
  return { url, points: row?.points ?? 0 }
}

/**
 * Membership anniversaries: members who joined on this store-time day in an earlier year get
 * the anniversary points once that year (`anniversary:<year>`; 29 Feb on 28 Feb otherwise).
 * Returns how many were given.
 */
export async function grantAnniversaryPoints(
  ctx: StoreContext,
  settings: LoyaltySettings,
  now: Date = new Date(),
  limit = 200,
): Promise<number> {
  const rule = await ruleByType(ctx, 'anniversary')
  if (!rule?.enabled || rule.points <= 0) return 0
  const timeZone = await storeCreditTimeZone(ctx)
  const today = dayKey(now, timeZone)
  const year = Number(today.slice(0, 4))
  const key = `anniversary:${year}`
  const due = await ctx.tx
    .select({ customerId: loyaltyMember.customerId })
    .from(loyaltyMember)
    .where(
      and(
        inArray(
          sql<string>`to_char(${loyaltyMember.joinedAt} at time zone ${timeZone}, 'MM-DD')`,
          birthdaysOn(today),
        ),
        sql`extract(year from ${loyaltyMember.joinedAt} at time zone ${timeZone}) < ${year}`,
        notExists(
          ctx.tx
            .select({ one: sql`1` })
            .from(loyaltyEntry)
            .where(
              and(
                eq(loyaltyEntry.customerId, loyaltyMember.customerId),
                eq(loyaltyEntry.earnKey, key),
              ),
            ),
        ),
      ),
    )
    .limit(limit)
  let given = 0
  for (const m of due) {
    const row = await grantRule(
      ctx,
      { customerId: m.customerId, rule, earnKey: key, reason: `Membership anniversary ${year}` },
      settings,
      now,
    )
    if (row) given += 1
  }
  return given
}
