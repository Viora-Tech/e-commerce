/** SOURCE OF TRUTH: checkout settings storage — WHAT: load and save Settings → Checkout (`store.preferences.checkout`) together with the cash on delivery fee, which stays the per-method fee on `store.payments.adjustments.cod` / WHY: one save must not overwrite other preferences or payment credentials, and the COD fee has one home that Settings → Payments and Settings → Checkout both edit */
import { store } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { type PaymentAdjustment, PaymentAdjustmentSchema } from '../payments/adjustments'
import { parsePaymentSettings } from '../payments/settings'
import { type CheckoutSettings, CheckoutSettingsSchema, parseCheckoutSettings } from './settings'

export type CheckoutSettingsView = {
  settings: CheckoutSettings
  /** Cash on delivery is switched on in Settings → Payments. */
  codEnabled: boolean
  /** The COD fee (or discount) from Settings → Payments; null when there is none. */
  codFee: PaymentAdjustment | null
}

export async function loadCheckoutSettings(ctx: StoreContext): Promise<CheckoutSettingsView> {
  const [s] = await ctx.tx
    .select({ preferences: store.preferences, payments: store.payments })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const payments = parsePaymentSettings(s?.payments)
  return {
    settings: parseCheckoutSettings(s?.preferences),
    codEnabled: payments.enabled.includes('cod'),
    codFee: payments.adjustments.cod ?? null,
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
