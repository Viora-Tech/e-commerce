/** SOURCE OF TRUTH: loyalty earning rules — WHAT: the `loyalty_earn_rule` rows (list, save, delete), the one-time move of v1's numbers (earn rate, review and birthday points) into rules so a store behaves the same, and the lookups the earn paths use (order rate and excluded tags, a rule's points with the v1 fallback) / WHY: v2 replaces the hard-coded review and birthday points with rules a merchant switches on and off; until a store's rules exist, v1 settings still decide */
import { loyaltyEarnRule } from '@commerce/db'
import { and, asc, eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { LoyaltyError } from './errors'
import {
  EarnRuleInputSchema,
  type LoyaltyRuleType,
  parseRuleSettings,
  RULE_SETTINGS,
} from './schemas'
import type { LoyaltySettings } from './settings'

export type EarnRuleRow = typeof loyaltyEarnRule.$inferSelect

/** The store's rules, in the merchant's order. */
export async function listEarnRules(ctx: StoreContext): Promise<EarnRuleRow[]> {
  return ctx.tx
    .select()
    .from(loyaltyEarnRule)
    .orderBy(asc(loyaltyEarnRule.position), asc(loyaltyEarnRule.createdAt), asc(loyaltyEarnRule.id))
}

/**
 * v1 → v2: a store with no rules yet gets three made from its v1 settings (order spend at the
 * v1 rate, product review and birthday at the v1 points, each on only when its number is
 * above 0), so earning stays exactly as it was. Safe to run on every sweep and in parallel
 * (unique type+key). Returns true when it made them.
 */
export async function ensureEarnRules(
  ctx: StoreContext,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<boolean> {
  const [has] = await ctx.tx.select({ n: sql<number>`count(*)::int` }).from(loyaltyEarnRule)
  if ((has?.n ?? 0) > 0) return false
  const v1 = [
    { type: 'order_spend' as const, points: settings.pointsPer100, position: 0 },
    { type: 'product_review' as const, points: settings.reviewPoints, position: 1 },
    { type: 'birthday' as const, points: settings.birthdayPoints, position: 2 },
  ]
  const made = await ctx.tx
    .insert(loyaltyEarnRule)
    .values(
      v1.map((r) => ({
        storeId: ctx.storeId,
        type: r.type,
        key: '',
        points: r.points,
        enabled: r.points > 0,
        position: r.position,
        settings: RULE_SETTINGS[r.type].parse({}) as Record<string, unknown>,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: loyaltyEarnRule.id })
  return made.length > 0
}

/**
 * Adds a rule (`id` null) or changes one. One rule per type (per platform for `social`):
 * a second is refused `invalid`.
 */
export async function saveEarnRule(
  ctx: StoreContext,
  id: string | null,
  raw: unknown,
  now: Date = new Date(),
): Promise<EarnRuleRow> {
  const input = EarnRuleInputSchema.parse(raw)
  const values = {
    type: input.type,
    key: input.key,
    title: input.title,
    points: input.points,
    settings: parseRuleSettings(input.type, input.settings) as Record<string, unknown>,
    enabled: input.enabled,
    position: input.position,
    updatedAt: now,
  }
  if (id) {
    const [row] = await ctx.tx
      .update(loyaltyEarnRule)
      .set(values)
      .where(eq(loyaltyEarnRule.id, id))
      .returning()
    if (!row) throw new LoyaltyError('not_found', 'Rule not found', ctx.storeId)
    return row
  }
  const [row] = await ctx.tx
    .insert(loyaltyEarnRule)
    .values({ ...values, storeId: ctx.storeId, createdAt: now })
    .onConflictDoNothing()
    .returning()
  if (!row) throw new LoyaltyError('invalid', 'That way to earn is already set up', ctx.storeId)
  return row
}

/** Removes a rule. Points it gave stay. */
export async function deleteEarnRule(ctx: StoreContext, id: string): Promise<void> {
  const gone = await ctx.tx
    .delete(loyaltyEarnRule)
    .where(eq(loyaltyEarnRule.id, id))
    .returning({ id: loyaltyEarnRule.id })
  if (gone.length === 0) throw new LoyaltyError('not_found', 'Rule not found', ctx.storeId)
}

/** The store's rule of a type (and platform), or null. */
export async function ruleByType(
  ctx: StoreContext,
  type: LoyaltyRuleType,
  key = '',
): Promise<EarnRuleRow | null> {
  const [row] = await ctx.tx
    .select()
    .from(loyaltyEarnRule)
    .where(and(eq(loyaltyEarnRule.type, type), eq(loyaltyEarnRule.key, key)))
  return row ?? null
}

/** A rule by id, or null. */
export async function ruleById(ctx: StoreContext, id: string): Promise<EarnRuleRow | null> {
  const [row] = await ctx.tx.select().from(loyaltyEarnRule).where(eq(loyaltyEarnRule.id, id))
  return row ?? null
}

/**
 * What a rule type gives now: the rule's points when on (0 when off), or `fallback` (the v1
 * number) while the store has no such rule yet.
 */
export async function rulePoints(
  ctx: StoreContext,
  type: LoyaltyRuleType,
  fallback: number,
): Promise<{ points: number; ruleId: string | null }> {
  const rule = await ruleByType(ctx, type)
  if (!rule) return { points: fallback, ruleId: null }
  return { points: rule.enabled ? rule.points : 0, ruleId: rule.id }
}

/** Order spend: points per ₹100, the product tags that earn nothing, and the rule. */
export async function orderEarnConfig(
  ctx: StoreContext,
  settings: LoyaltySettings,
): Promise<{ pointsPer100: number; excludeTags: string[]; ruleId: string | null }> {
  const rule = await ruleByType(ctx, 'order_spend')
  if (!rule) return { pointsPer100: settings.pointsPer100, excludeTags: [], ruleId: null }
  const s = parseRuleSettings('order_spend', rule.settings)
  return {
    pointsPer100: rule.enabled ? rule.points : 0,
    excludeTags: s.excludeProductTags,
    ruleId: rule.id,
  }
}

/**
 * The v1 settings page still saves the earn rate, review and birthday points: copy a changed
 * number onto its rule, so both pages agree until the v2 page replaces it.
 */
export async function syncV1RuleNumbers(
  ctx: StoreContext,
  prev: LoyaltySettings,
  next: LoyaltySettings,
  now: Date = new Date(),
): Promise<void> {
  const pairs = [
    ['order_spend', prev.pointsPer100, next.pointsPer100],
    ['product_review', prev.reviewPoints, next.reviewPoints],
    ['birthday', prev.birthdayPoints, next.birthdayPoints],
  ] as const
  for (const [type, before, after] of pairs) {
    if (before === after) continue
    await ctx.tx
      .update(loyaltyEarnRule)
      .set({ points: after, enabled: after > 0, updatedAt: now })
      .where(and(eq(loyaltyEarnRule.type, type), eq(loyaltyEarnRule.key, '')))
  }
}
