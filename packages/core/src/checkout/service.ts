/** SOURCE OF TRUTH: checkout settings storage — WHAT: load and save Settings → Checkout (`store.preferences.checkout`) together with the cash on delivery fee, which stays the per-method fee on `store.payments.adjustments.cod` / WHY: one save must not overwrite other preferences or payment credentials, and the COD fee has one home that Settings → Payments and Settings → Checkout both edit */
import { media, store, variant } from '@commerce/db'
import { eq, inArray, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { type PaymentAdjustment, PaymentAdjustmentSchema } from '../payments/adjustments'
import { parsePaymentSettings } from '../payments/settings'
import { liveThemeSettings } from '../theme/library'
import type { CheckoutBranding } from './branding'
import { type CheckoutSettings, CheckoutSettingsSchema, parseCheckoutSettings } from './settings'

export type CheckoutSettingsView = {
  settings: CheckoutSettings
  /** Cash on delivery is switched on in Settings → Payments. */
  codEnabled: boolean
  /** The COD fee (or discount) from Settings → Payments; null when there is none. */
  codFee: PaymentAdjustment | null
  /** For the Branding preview's header when no logo is picked. */
  storeName: string
}

export async function loadCheckoutSettings(ctx: StoreContext): Promise<CheckoutSettingsView> {
  const [s] = await ctx.tx
    .select({ name: store.name, preferences: store.preferences, payments: store.payments })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const payments = parsePaymentSettings(s?.payments)
  return {
    settings: parseCheckoutSettings(s?.preferences),
    codEnabled: payments.enabled.includes('cod'),
    codFee: payments.adjustments.cod ?? null,
    storeName: s?.name ?? '',
  }
}

/**
 * Save Settings → Checkout. Only `preferences.checkout` and
 * `payments.adjustments.cod` change; both are merged in SQL so SEO, the
 * password page, gateway credentials and every other key stay as they are.
 * `codFee` undefined leaves the fee alone, null removes it.
 */
export async function saveCheckoutSettings(
  ctx: StoreContext,
  input: { settings: unknown; codFee?: unknown },
): Promise<CheckoutSettingsView> {
  const checkout = CheckoutSettingsSchema.parse(input.settings)
  const set: Partial<Record<'preferences' | 'payments', ReturnType<typeof sql>>> = {
    preferences: sql`coalesce(${store.preferences}, '{}'::jsonb) || ${JSON.stringify({ checkout })}::jsonb`,
  }
  if (input.codFee !== undefined) {
    const fee = input.codFee === null ? null : PaymentAdjustmentSchema.parse(input.codFee)
    const adjustments = sql`coalesce(${store.payments} -> 'adjustments', '{}'::jsonb)`
    set.payments = fee
      ? sql`coalesce(${store.payments}, '{}'::jsonb) || jsonb_build_object('adjustments', ${adjustments} || jsonb_build_object('cod', ${JSON.stringify(fee)}::jsonb))`
      : sql`coalesce(${store.payments}, '{}'::jsonb) || jsonb_build_object('adjustments', ${adjustments} - 'cod')`
  }
  await ctx.tx.update(store).set(set).where(eq(store.id, ctx.storeId))
  return loadCheckoutSettings(ctx)
}

/** Checkout settings alone, for the storefront. */
export async function storeCheckoutSettings(ctx: StoreContext): Promise<CheckoutSettings> {
  return (await loadCheckoutSettings(ctx)).settings
}

/**
 * Each variant's own image, for the thank-you page's summary (order lines keep the title
 * and price they were bought at, not an image). Variants without one are left out.
 */
export async function variantImageUrls(
  ctx: StoreContext,
  variantIds: readonly string[],
): Promise<Record<string, string>> {
  if (variantIds.length === 0) return {}
  const rows = await ctx.tx
    .select({ id: variant.id, url: media.url })
    .from(variant)
    .innerJoin(media, eq(media.id, variant.mediaId))
    .where(inArray(variant.id, [...variantIds]))
  return Object.fromEntries(rows.map((r) => [r.id, r.url]))
}

/** What the locked checkout draws at the top: its branding, the store name, and a logo. */
export type CheckoutLook = {
  branding: CheckoutBranding
  storeName: string
  /** Settings → Checkout → Branding's logo, else the live theme's, else null (the name shows). */
  logoUrl: string | null
}

/**
 * The checkout's look for the storefront. Only the logo may come from the theme, as a
 * fallback; colours, type and corners never do, so no theme can restyle the checkout.
 */
export async function storeCheckoutLook(ctx: StoreContext): Promise<CheckoutLook> {
  const [s] = await ctx.tx
    .select({ name: store.name, preferences: store.preferences })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const { branding } = parseCheckoutSettings(s?.preferences)
  const themeLogo = branding.logo ? null : (await liveThemeSettings(ctx.tx, ctx.storeId)).brand.logo
  return {
    branding,
    storeName: s?.name ?? '',
    logoUrl: branding.logo?.url ?? themeLogo?.url ?? null,
  }
}
