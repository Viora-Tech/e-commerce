/** SOURCE OF TRUTH: A/B rollout reads and events — activeAbTests, recordAbExposure,
 *   recordAbAddToCart, recordAbPurchase, rolloutAbResults
 * WHAT:  What the storefront needs to split a running A/B rollout (its Treatment theme and
 *        audience), the events it writes per visitor (`rollout_ab_event`), and the results card's
 *        numbers per arm: visitors reached, sessions (`marketing_session` by visitor id),
 *        add-to-cart rate, conversion and revenue per visitor, with the z-test hint.
 * WHY:   Assignment is a hash (`ab.ts`), so nothing is stored until a visitor is drawn; the
 *        exposure row then fixes the arm every later event is counted under.
 */
import {
  market,
  marketingSession,
  order,
  type RolloutArm,
  type RolloutAudience,
  rollout,
  rolloutAbEvent,
  rolloutChange,
  type StoreTx,
} from '@commerce/db'
import { and, asc, count, countDistinct, eq, gte, isNotNull, lte, sql, sum } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { type AbVerdict, abRate, abVerdict } from './ab'
import { mustGet } from './views'

/** A running A/B rollout as the storefront splits it. */
export type ActiveAbTest = {
  id: string
  /** The theme Treatment visitors see. */
  themeId: string
  audience: RolloutAudience
}

/** Running A/B rollouts with a theme change, oldest first (the first one a visitor is in wins). */
export async function activeAbTests(tx: StoreTx): Promise<ActiveAbTest[]> {
  const rows = await tx
    .select({ id: rollout.id, audience: rollout.audience, themeId: rolloutChange.targetId })
    .from(rollout)
    .innerJoin(
      rolloutChange,
      and(eq(rolloutChange.rolloutId, rollout.id), eq(rolloutChange.kind, 'theme')),
    )
    .where(and(eq(rollout.status, 'active'), isNotNull(rollout.audience)))
    .orderBy(rollout.startedAt)
  return rows.flatMap((r) =>
    r.audience && r.themeId ? [{ id: r.id, themeId: r.themeId, audience: r.audience }] : [],
  )
}

/** A visitor drawn in an arm; their first exposure fixes it (later ones add nothing). */
export async function recordAbExposure(
  tx: StoreTx,
  storeId: string,
  input: { rolloutId: string; visitorId: string; arm: RolloutArm },
): Promise<void> {
  await tx
    .insert(rolloutAbEvent)
    .values({
      storeId,
      rolloutId: input.rolloutId,
      visitorId: input.visitorId.slice(0, 64),
      arm: input.arm,
      kind: 'exposure',
    })
    .onConflictDoNothing()
}

/** The visitor's first add to cart, in every running test they were drawn in. */
export async function recordAbAddToCart(
  tx: StoreTx,
  storeId: string,
  visitorId: string,
): Promise<void> {
  await tx.execute(sql`
    insert into ${rolloutAbEvent} (id, store_id, rollout_id, visitor_id, arm, kind)
    select gen_random_uuid(), ${storeId}::uuid, e.rollout_id, e.visitor_id, e.arm, 'add_to_cart'
    from ${rolloutAbEvent} e
    join ${rollout} r on r.id = e.rollout_id and r.status = 'active'
    where e.visitor_id = ${visitorId.slice(0, 64)} and e.kind = 'exposure'
    on conflict do nothing
  `)
}

/** An order counts only while fresh: its thank-you page, not an old link. */
const PURCHASE_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * An order by this visitor, in every running or paused test they were drawn in: once per order,
 * only a real order of this store placed in the last day.
 */
export async function recordAbPurchase(
  tx: StoreTx,
  storeId: string,
  visitorId: string,
  orderId: string,
  now = new Date(),
): Promise<void> {
  const [o] = await tx
    .select({ id: order.id, total: order.totalPaise, placedAt: order.placedAt, test: order.isTest })
    .from(order)
    .where(eq(order.id, orderId))
  if (!o || o.test || now.getTime() - o.placedAt.getTime() > PURCHASE_WINDOW_MS) return
  await tx.execute(sql`
    insert into ${rolloutAbEvent}
      (id, store_id, rollout_id, visitor_id, arm, kind, order_id, value_minor)
    select gen_random_uuid(), ${storeId}::uuid, e.rollout_id, e.visitor_id, e.arm, 'purchase',
      ${o.id}::uuid, ${o.total}::bigint
    from ${rolloutAbEvent} e
    join ${rollout} r on r.id = e.rollout_id and r.status in ('active', 'paused')
    where e.visitor_id = ${visitorId.slice(0, 64)} and e.kind = 'exposure'
    on conflict do nothing
  `)
}

/** One arm's results. Rates are shares in [0, 1]; money is in the store currency's minor unit. */
export type AbArmResult = {
  visitors: number
  sessions: number
  addToCartRate: number
  orders: number
  conversionRate: number
  revenueMinor: number
  revenuePerVisitorMinor: number
}

export type RolloutAbResults = {
  control: AbArmResult
  treatment: AbArmResult
  /** Visitors drawn in either arm, and the target they aim for (null: no target). */
  reached: number
  target: number | null
  verdict: AbVerdict
}

const ARMS: RolloutArm[] = ['control', 'treatment']

/** An A/B rollout's numbers per arm; null for a rollout without a test. */
export async function rolloutAbResults(
  ctx: StoreContext,
  id: string,
): Promise<RolloutAbResults | null> {
  const r = await mustGet(ctx, id)
  if (!r.audience) return null
  const events = await ctx.tx
    .select({
      arm: rolloutAbEvent.arm,
      kind: rolloutAbEvent.kind,
      rows: count(),
      visitors: countDistinct(rolloutAbEvent.visitorId),
      value: sum(rolloutAbEvent.valueMinor),
    })
    .from(rolloutAbEvent)
    .where(eq(rolloutAbEvent.rolloutId, id))
    .groupBy(rolloutAbEvent.arm, rolloutAbEvent.kind)
  // Sessions the drawn visitors started while the test ran.
  const sessions = r.startedAt
    ? await ctx.tx
        .select({ arm: rolloutAbEvent.arm, n: count() })
        .from(rolloutAbEvent)
        .innerJoin(marketingSession, eq(marketingSession.visitorId, rolloutAbEvent.visitorId))
        .where(
          and(
            eq(rolloutAbEvent.rolloutId, id),
            eq(rolloutAbEvent.kind, 'exposure'),
            gte(marketingSession.startedAt, r.startedAt),
            r.endedAt ? lte(marketingSession.startedAt, r.endedAt) : undefined,
          ),
        )
        .groupBy(rolloutAbEvent.arm)
    : []
  const pick = (arm: RolloutArm, kind: string) =>
    events.find((e) => e.arm === arm && e.kind === kind)
  const result = (arm: RolloutArm): AbArmResult & { buyers: number } => {
    const visitors = pick(arm, 'exposure')?.visitors ?? 0
    const purchases = pick(arm, 'purchase')
    const buyers = purchases?.visitors ?? 0
    const revenueMinor = Number(purchases?.value ?? 0)
    return {
      visitors,
      sessions: sessions.find((s) => s.arm === arm)?.n ?? 0,
      addToCartRate: abRate(pick(arm, 'add_to_cart')?.visitors ?? 0, visitors),
      orders: purchases?.rows ?? 0,
      conversionRate: abRate(buyers, visitors),
      revenueMinor,
      revenuePerVisitorMinor: visitors > 0 ? Math.round(revenueMinor / visitors) : 0,
      buyers,
    }
  }
  const [control, treatment] = ARMS.map(result) as [
    AbArmResult & { buyers: number },
    AbArmResult & { buyers: number },
  ]
  const { buyers: controlBuyers, ...controlOut } = control
  const { buyers: treatmentBuyers, ...treatmentOut } = treatment
  return {
    control: controlOut,
    treatment: treatmentOut,
    reached: control.visitors + treatment.visitors,
    target: r.audience.target,
    verdict: abVerdict(
      { visitors: control.visitors, conversions: controlBuyers },
      { visitors: treatment.visitors, conversions: treatmentBuyers },
    ),
  }
}

/** Markets an A/B test can be limited to. */
export type RolloutMarketOption = { id: string; name: string }

/** The store's enabled markets, the primary first; none while the store sells in India only. */
export async function rolloutMarketOptions(ctx: StoreContext): Promise<RolloutMarketOption[]> {
  return ctx.tx
    .select({ id: market.id, name: market.name })
    .from(market)
    .where(eq(market.enabled, true))
    .orderBy(sql`${market.isPrimary} desc`, asc(market.name))
}
