/** SOURCE OF TRUTH: EMI & pay later app — WHAT its settings mean and WHEN the product page shows an offer. */
import { type CheckoutMethod, checkoutMethodsOf } from '@commerce/core/payment-methods'
import { z } from 'zod'
import type { EmiOffersConfig } from './offer-for'

export { type EmiOffersConfig, emiOfferFor } from './offer-for'

/*
 * Pure (no database, no network), so the storefront's client components and
 * the admin import it through `@commerce/plugin-emi/offer`. Settings live in
 * the store's existing `store.apps` JSON under this app's id (no table, no
 * migration); the admin writes them through the API, the storefront reads
 * them with the payment settings and calls `emiOffersConfig`.
 */

export const EMI_PAY_LATER_ID = 'emi-pay-later'

/** Gateways whose checkout takes EMI and pay later. Razorpay also has an official product-page widget. */
export const EMI_GATEWAYS = ['razorpay', 'cashfree'] as const
export type EmiGateway = (typeof EMI_GATEWAYS)[number]

const minPrice = z.number().int().min(0).max(100_000_000)

export const EmiWidgetSettingsSchema = z.object({
  /** Show the offer on product pages. */
  enabled: z.boolean().default(true),
  /** Whose EMI and pay later the shopper gets at checkout. */
  gateway: z.enum(EMI_GATEWAYS).default('razorpay'),
  /** Products cheaper than this show nothing; most lenders start around ₹1,000. */
  minPricePaise: minPrice.default(100_000),
})
export type EmiWidgetSettings = z.infer<typeof EmiWidgetSettingsSchema>

/**
 * A save from the settings page. Written out rather than `.partial()`, which
 * in zod 4 fills every missing field with its default and would reset what
 * the merchant saved before.
 */
export const EmiWidgetSettingsPatchSchema = z.object({
  enabled: z.boolean().optional(),
  gateway: z.enum(EMI_GATEWAYS).optional(),
  minPricePaise: minPrice.optional(),
})
export type EmiWidgetSettingsPatch = z.infer<typeof EmiWidgetSettingsPatchSchema>

export const defaultEmiWidgetSettings: EmiWidgetSettings = EmiWidgetSettingsSchema.parse({})

export function parseEmiWidgetSettings(raw: unknown): EmiWidgetSettings {
  const r = EmiWidgetSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultEmiWidgetSettings
}

/** The slice of `store.payments` this app reads. `PaymentSettings` satisfies it. */
export type EmiPaymentsView = {
  enabled: string[]
  methods?: CheckoutMethod[] | undefined
  providers?: Record<string, Record<string, string>> | undefined
}

/**
 * Why the product page does or does not show an offer, in the order a
 * merchant would fix it. `ready` is the only state that shows anything.
 */
export type EmiReadiness = 'off' | 'gateway-not-set-up' | 'emi-off-at-checkout' | 'ready'

export function emiReadiness(settings: EmiWidgetSettings, payments: EmiPaymentsView): EmiReadiness {
  if (!settings.enabled) return 'off'
  if (!payments.enabled.includes(settings.gateway)) return 'gateway-not-set-up'
  const emi = checkoutMethodsOf(payments).find((m) => m.id === 'emi')
  if (!emi?.on) return 'emi-off-at-checkout'
  return 'ready'
}

/**
 * The Razorpay key id the official widget needs (the public `rzp_…` id,
 * never the secret), when the chosen gateway is Razorpay and one is saved.
 */
export function razorpayKeyIdOf(settings: EmiWidgetSettings, payments: EmiPaymentsView) {
  if (settings.gateway !== 'razorpay') return null
  const keyId = payments.providers?.razorpay?.keyId
  return keyId?.startsWith('rzp_') ? keyId : null
}

/** Null unless the app is on, the gateway is set up and EMI is on at checkout. */
export function emiOffersConfig(
  settings: EmiWidgetSettings,
  payments: EmiPaymentsView,
): EmiOffersConfig | null {
  if (emiReadiness(settings, payments) !== 'ready') return null
  return {
    minPricePaise: settings.minPricePaise,
    razorpayKeyId: razorpayKeyIdOf(settings, payments),
  }
}

/** The settings after a save: fields the patch leaves out keep their saved value. */
export function applyEmiSettingsPatch(
  current: EmiWidgetSettings,
  patch: EmiWidgetSettingsPatch,
): EmiWidgetSettings {
  const given = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
  return EmiWidgetSettingsSchema.parse({ ...current, ...given })
}
