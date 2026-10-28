/** SOURCE OF TRUTH: applyRolloutChange, revertRolloutChange
 * WHAT:  What each kind of rollout change does to the store, and how it is put back: the live
 *        theme (publish another, later republish the one it replaced), the checkout branding
 *        (`store.preferences.checkout.branding`) and a discount's status. Applying records what
 *        was there in `previous`; reverting restores it only while the store still shows what
 *        the rollout set, so anything the merchant changed by hand meanwhile stays.
 * WHY:   An event (a sale weekend) must end exactly where the store was, and must never undo a
 *        later decision of the merchant's.
 */
import { discount, type RolloutChangeKind, rolloutChange, store, theme } from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
import { CheckoutBrandingSchema } from '../checkout/branding'
import type { StoreContext } from '../context'
import { publishTheme } from '../theme/library'
import { mainThemeId } from '../theme/templates'

/** One change as stored. */
export type StoredRolloutChange = {
  id: string
  kind: RolloutChangeKind
  targetId: string | null
  value: unknown
  previous: unknown
}

/** A change that cannot be applied now, with the reason the merchant reads. */
export class RolloutChangeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RolloutChangeError'
  }
}

const discountStatusOf = (value: unknown): 'active' | 'disabled' =>
  (value as { status?: unknown } | null)?.status === 'disabled' ? 'disabled' : 'active'

/** The branding stored on the store, as saved (not filled with defaults); null when none. */
async function storedBranding(ctx: StoreContext): Promise<unknown> {
  const [s] = await ctx.tx
    .select({ branding: sql<unknown>`${store.preferences} -> 'checkout' -> 'branding'` })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  return s?.branding ?? null
}

/** Sets (or, with null, removes) the stored checkout branding, keeping every other preference. */
async function setBranding(ctx: StoreContext, branding: unknown): Promise<void> {
  const checkout = sql`coalesce(${store.preferences} -> 'checkout', '{}'::jsonb)`
  const next =
    branding === null
      ? sql`${checkout} - 'branding'`
      : sql`${checkout} || jsonb_build_object('branding', ${JSON.stringify(branding)}::jsonb)`
  await ctx.tx
    .update(store)
    .set({
      preferences: sql`coalesce(${store.preferences}, '{}'::jsonb) || jsonb_build_object('checkout', ${next})`,
    })
    .where(eq(store.id, ctx.storeId))
}

/** JSON with object keys sorted: jsonb hands keys back in its own order. */
const canonical = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
        )
      : v

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

/** Applies one change and records what it replaced. Throws `RolloutChangeError` when it cannot. */
export async function applyRolloutChange(
  ctx: StoreContext,
  change: StoredRolloutChange,
  at: Date,
): Promise<void> {
  let previous: unknown
  if (change.kind === 'theme') {
    const [target] = await ctx.tx
      .select({ id: theme.id })
      .from(theme)
      .where(eq(theme.id, change.targetId as string))
    if (!target) throw new RolloutChangeError('The theme this rollout publishes was deleted.')
    previous = { themeId: await mainThemeId(ctx.tx) }
    await publishTheme(ctx.tx, target.id)
  } else if (change.kind === 'checkout_branding') {
    previous = { branding: await storedBranding(ctx) }
    await setBranding(ctx, CheckoutBrandingSchema.parse(change.value))
  } else {
    const [d] = await ctx.tx
      .select({ status: discount.status })
      .from(discount)
      .where(eq(discount.id, change.targetId as string))
    if (!d) throw new RolloutChangeError('A discount in this rollout was deleted.')
    previous = { status: d.status }
    await ctx.tx
      .update(discount)
      .set({ status: discountStatusOf(change.value) })
      .where(eq(discount.id, change.targetId as string))
  }
  await ctx.tx
    .update(rolloutChange)
    .set({ previous, appliedAt: at })
    .where(eq(rolloutChange.id, change.id))
}

/**
 * Puts back what one applied change replaced, only while the store still shows what the
 * rollout set. Returns false when it was left alone (changed by hand meanwhile, or the
 * replaced theme or discount is gone).
 */
export async function revertRolloutChange(
  ctx: StoreContext,
  change: StoredRolloutChange,
): Promise<boolean> {
  const prev = (change.previous ?? {}) as {
    themeId?: string | null
    branding?: unknown
    status?: string
  }
  let reverted = false
  if (change.kind === 'theme') {
    const live = await mainThemeId(ctx.tx)
    if (live === change.targetId && prev.themeId) {
      const [back] = await ctx.tx
        .select({ id: theme.id })
        .from(theme)
        .where(eq(theme.id, prev.themeId))
      if (back) {
        await publishTheme(ctx.tx, back.id)
        reverted = true
      }
    }
  } else if (change.kind === 'checkout_branding') {
    const now = await storedBranding(ctx)
    if (same(now, CheckoutBrandingSchema.parse(change.value))) {
      await setBranding(ctx, prev.branding ?? null)
      reverted = true
    }
  } else {
    const set = discountStatusOf(change.value)
    const rows = await ctx.tx
      .update(discount)
      .set({ status: prev.status === 'disabled' ? 'disabled' : 'active' })
      .where(and(eq(discount.id, change.targetId as string), eq(discount.status, set)))
      .returning({ id: discount.id })
    reverted = rows.length > 0
  }
  await ctx.tx.update(rolloutChange).set({ appliedAt: null }).where(eq(rolloutChange.id, change.id))
  return reverted
}
