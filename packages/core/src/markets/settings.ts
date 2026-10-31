/** SOURCE OF TRUTH: MarketSettingsSchema, parseMarketSettings, getMarketSettings, saveMarketSettings
 * WHAT:  Settings for every market at once, kept in `store.preferences.markets`: whether the
 *        storefront suggests the visitor's own market ("Shopping from the UAE? Shop in AED").
 * WHY:   One save touches only its own key, so other preferences are never overwritten; no
 *        migration needed. The storefront layout reads it (`parseMarketSettings`).
 * WHERE: `markets.settings` / `markets.saveSettings` (api), Markets (admin), the storefront layout.
 */
import { type StoreTx, store } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { StoreContext } from '../context'

export const MarketSettingsSchema = z.object({
  /** Suggest the market of the visitor's country when the page shows another one. */
  suggestMarket: z.boolean().default(true),
})
export type MarketSettings = z.infer<typeof MarketSettingsSchema>

const defaultMarketSettings: MarketSettings = MarketSettingsSchema.parse({})

/** The saved settings from `store.preferences`, defaults for anything missing or invalid. */
export function parseMarketSettings(preferences: unknown): MarketSettings {
  const raw =
    preferences && typeof preferences === 'object'
      ? (preferences as { markets?: unknown }).markets
      : undefined
  const r = MarketSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultMarketSettings
}

export async function getMarketSettings(ctx: StoreContext): Promise<MarketSettings> {
  const [row] = await ctx.tx
    .select({ preferences: store.preferences })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  return parseMarketSettings(row?.preferences)
}

/** Saves the market settings; only `preferences.markets` changes. */
export async function saveMarketSettings(
  ctx: { tx: StoreTx; storeId: string },
  raw: z.input<typeof MarketSettingsSchema>,
): Promise<MarketSettings> {
  const markets = MarketSettingsSchema.parse(raw)
  await ctx.tx
    .update(store)
    .set({
      preferences: sql`coalesce(${store.preferences}, '{}'::jsonb) || ${JSON.stringify({ markets })}::jsonb`,
    })
    .where(eq(store.id, ctx.storeId))
  return markets
}
