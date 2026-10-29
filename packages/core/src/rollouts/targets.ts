/** SOURCE OF TRUTH: rolloutHolds, rolloutThemeOptions, rolloutDiscountOptions
 * WHAT:  What the rollout pages pick from and what the rest of the admin shows about rollouts:
 *        the theme library and the discounts a rollout can change, and which unended rollout
 *        holds each theme, each discount and the checkout ("In rollout: Diwali sale").
 * WHY:   A merchant editing a theme, a discount or the checkout must see that a scheduled sale
 *        will change it; the rollout page lists themes and discounts under `rollouts.read`
 *        without needing the theme or discount permissions.
 */
import {
  type DiscountStatus,
  discount,
  type RolloutStatus,
  rollout,
  rolloutChange,
  theme,
} from '@commerce/db'
import { asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { UNENDED } from './views'

/** The unended rollout that holds a theme, a discount or the checkout. */
export type RolloutHold = { id: string; name: string; status: RolloutStatus }

export type RolloutHolds = {
  themes: Record<string, RolloutHold>
  discounts: Record<string, RolloutHold>
  checkout: RolloutHold | null
}

/** Running first, then the next to start, then drafts: the one the chip should name. */
const RANK: Record<string, number> = { active: 0, paused: 1, scheduled: 2, draft: 3 }

/** Which unended rollout holds each theme, discount and the checkout branding. */
export async function rolloutHolds(ctx: StoreContext): Promise<RolloutHolds> {
  const rows = await ctx.tx
    .select({
      id: rollout.id,
      name: rollout.name,
      status: rollout.status,
      kind: rolloutChange.kind,
      targetId: rolloutChange.targetId,
    })
    .from(rolloutChange)
    .innerJoin(rollout, eq(rollout.id, rolloutChange.rolloutId))
    .where(inArray(rollout.status, UNENDED))
    .orderBy(asc(rollout.startsAt))
  const out: RolloutHolds = { themes: {}, discounts: {}, checkout: null }
  const better = (now: RolloutHold | null | undefined, next: RolloutHold) =>
    !now || (RANK[next.status] ?? 9) < (RANK[now.status] ?? 9)
  for (const r of rows) {
    const hold = { id: r.id, name: r.name, status: r.status }
    if (r.kind === 'checkout_branding') {
      if (better(out.checkout, hold)) out.checkout = hold
      continue
    }
    const map = r.kind === 'theme' ? out.themes : out.discounts
    if (r.targetId && better(map[r.targetId], hold)) map[r.targetId] = hold
  }
  return out
}

export type RolloutThemeOption = { id: string; name: string; live: boolean }

/** The theme library, the live theme first: what a rollout can publish. */
export async function rolloutThemeOptions(ctx: StoreContext): Promise<RolloutThemeOption[]> {
  const rows = await ctx.tx
    .select({ id: theme.id, name: theme.name, role: theme.role })
    .from(theme)
    .orderBy(sql`case when ${theme.role} = 'main' then 0 else 1 end`, desc(theme.updatedAt))
  return rows.map((t) => ({ id: t.id, name: t.name, live: t.role === 'main' }))
}

export type RolloutDiscountOption = {
  id: string
  title: string
  code: string | null
  status: DiscountStatus
}

/** One page of discounts by title or code, for the rollout's discount picker. */
export async function rolloutDiscountOptions(
  ctx: StoreContext,
  input: { page: number; perPage: number; search?: string | undefined },
): Promise<{ items: RolloutDiscountOption[]; total: number }> {
  const term = input.search?.trim()
  const where = term
    ? or(ilike(discount.title, `%${term}%`), ilike(discount.code, `%${term}%`))
    : undefined
  const items = await ctx.tx
    .select({
      id: discount.id,
      title: discount.title,
      code: discount.code,
      status: discount.status,
    })
    .from(discount)
    .where(where)
    .orderBy(asc(discount.title))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  const [total] = await ctx.tx.select({ n: count() }).from(discount).where(where)
  return { items, total: total?.n ?? 0 }
}
