/** SOURCE OF TRUTH: checkout settings storage — WHAT: load and save Settings → Checkout (`store.preferences.checkout`) together with the cash on delivery fee, which stays the per-method fee on `store.payments.adjustments.cod` / WHY: one save must not overwrite other preferences or payment credentials, and the COD fee has one home that Settings → Payments and Settings → Checkout both edit */
import { media, store, variant } from '@commerce/db'
import { eq, inArray, sql } from 'drizzle-orm'
import { productFirstImages } from '../cart/cart'
import type { StoreContext } from '../context'
import { type PaymentAdjustment, PaymentAdjustmentSchema } from '../payments/adjustments'
import { parsePaymentSettings } from '../payments/settings'
import { liveThemeSettings } from '../theme/library'
import { type CheckoutBranding, DEFAULT_CHECKOUT_COLOURS } from './branding'
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
  const settings = parseCheckoutSettings(s?.preferences)
  const branding = await withThemeColours(ctx, s?.preferences, settings.branding)
  return {
    settings: { ...settings, branding },
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
    .select({ id: variant.id, productId: variant.productId, url: media.url })
    .from(variant)
    .leftJoin(media, eq(media.id, variant.mediaId))
    .where(inArray(variant.id, [...variantIds]))
  // A variant with no photo of its own shows its product's first one, as the cart does (the
  // thank-you and pay pages showed a letter tile for such products, 2026-10-28).
  const firsts = await productFirstImages(
    ctx,
    rows.filter((r) => !r.url).map((r) => r.productId),
  )
  return Object.fromEntries(
    rows.flatMap((r) => {
      const url = r.url ?? firsts.get(r.productId)
      return url ? [[r.id, url]] : []
    }),
  )
}

/** What the locked checkout draws at the top: its branding, the store name, and a logo. */
export type CheckoutLook = {
  branding: CheckoutBranding
  storeName: string
  /** Settings → Checkout → Branding's logo, else the live theme's, else null (the name shows). */
  logoUrl: string | null
  /** The store's contact number (Settings → Store details), for "Need help? WhatsApp us". */
  contactPhone: string | null
}

/** Brand colour of the live theme: its light scheme's button colour. */
type Theme = Awaited<ReturnType<typeof liveThemeSettings>>
const themeBrandColour = (theme: Theme) =>
  (theme.schemes.find((x) => x.id === theme.lightScheme) ?? theme.schemes[0])?.button ?? null

/**
 * The branding colours this store has actually picked. Every save writes the whole branding,
 * defaults included, so a stored stock colour counts as not picked.
 */
function savedColours(preferences: unknown): { accent: boolean; button: boolean } {
  const branding = (preferences as { checkout?: { branding?: Record<string, unknown> } } | null)
    ?.checkout?.branding
  const picked = (v: unknown, stock: string) =>
    typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) && v.toUpperCase() !== stock.toUpperCase()
  return {
    accent: picked(branding?.accent, DEFAULT_CHECKOUT_COLOURS.accent),
    button: picked(branding?.button, DEFAULT_CHECKOUT_COLOURS.button),
  }
}

/**
 * Until a store picks its own checkout accent and Pay button colours, both follow its live
 * theme's brand colour, so a new store's checkout matches its shop instead of a stock blue.
 * Only the value is borrowed: no theme CSS reaches the checkout, and a saved colour always wins.
 */
async function withThemeColours(
  ctx: StoreContext,
  preferences: unknown,
  branding: CheckoutBranding,
  theme?: Theme,
): Promise<CheckoutBranding> {
  const saved = savedColours(preferences)
  if (saved.accent && saved.button) return branding
  const brand = themeBrandColour(theme ?? (await liveThemeSettings(ctx.tx, ctx.storeId)))
  if (!brand) return branding
  return {
    ...branding,
    accent: saved.accent ? branding.accent : brand,
    button: saved.button ? branding.button : brand,
  }
}

/**
 * The checkout's look for the storefront. The theme only supplies fallbacks (the logo, and the
 * accent and Pay button colours until the store picks its own); type, corners and the rest never
 * come from it, and no theme CSS reaches the checkout.
 */
export async function storeCheckoutLook(ctx: StoreContext): Promise<CheckoutLook> {
  const [s] = await ctx.tx
    .select({ name: store.name, preferences: store.preferences, phone: store.contactPhone })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const parsed = parseCheckoutSettings(s?.preferences).branding
  const saved = savedColours(s?.preferences)
  const theme =
    parsed.logo && saved.accent && saved.button
      ? null
      : await liveThemeSettings(ctx.tx, ctx.storeId)
  const branding = theme ? await withThemeColours(ctx, s?.preferences, parsed, theme) : parsed
  return {
    branding,
    storeName: s?.name ?? '',
    logoUrl: branding.logo?.url ?? theme?.brand.logo?.url ?? null,
    contactPhone: s?.phone ?? null,
  }
}
