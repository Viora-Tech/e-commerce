import { type PaymentProvider, PaymentRegistry } from '@commerce/payments'
import { z } from 'zod'
import { codFactory } from '../providers/cod'
import { manualFactory } from '../providers/manual'
import {
  decryptProviderSettings,
  encryptProviderSettings,
  maskProviderSettings,
} from '../settings/secrets'
import { PaymentAdjustmentSchema } from './adjustments'
import { CaptureModeSchema } from './capture'
import { ManualRowsSchema, manualConfigForCheckout } from './manual-rows'
import { PaymentMethodRulesSchema } from './method-rules'
import { CheckoutMethodSchema } from './methods'
import { baseProviderId, isGatewayInactive } from './modes'
import { PaymentRoutingSchema } from './routing'

/** Stored on store.payments. Secret fields are encrypted before they reach the row. */
export const PaymentSettingsSchema = z.object({
  /** Methods shown at checkout, in order. 'cod' is built in; others must be registered. */
  enabled: z.array(z.string().min(1)).default(['cod']),
  /**
   * Per provider id, its config. A gateway's waiting key set (the Live or Test
   * one checkout is not using) sits under `<id>~<mode>`; see ./modes.
   */
  providers: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  /**
   * Gateways the merchant switched off (Active/Inactive), each with the
   * provider ids it had on, restored when switched on again. Keys are kept.
   */
  inactive: z.record(z.string(), z.array(z.string())).optional(),
  /** Optional fee or discount per method id, applied to the order total at checkout. */
  adjustments: z.record(z.string(), PaymentAdjustmentSchema).default({}),
  /**
   * Cancel online-payment orders still unpaid after this many minutes and
   * release their stock. 0 turns it off. COD and manual transfers never expire.
   */
  expireUnpaidAfterMinutes: z.number().int().min(0).max(10_080).default(30),
  /**
   * "Cancel unpaid UPI and bank transfer orders automatically": the merchant's own choice.
   * Unset means they never chose, and the default (on) applies; `off` is kept off. Read it
   * through `manualCancelHoursOf`, never on its own.
   */
  manualAutoCancel: z.enum(['on', 'off']).optional(),
  /**
   * Hours after a manual UPI / bank transfer order is placed before it is cancelled unpaid,
   * releasing its stock. 0 means "not set" (the 6 hour default); stored values outside 1 to
   * 72 are clamped by `manualCancelHoursOf`. Marking the order paid stops it.
   */
  manualCancelAfterHours: z.number().int().min(0).max(720).default(0),
  /**
   * Repeated checkouts (`order/duplicate-checkout.ts`): how far back, in hours, the same items
   * from the same shopper count as the same order (unpaid: refused and resumed; paid: asked
   * "Order again?"). 0 turns the check off.
   */
  duplicateCheckoutHours: z.number().int().min(0).max(168).default(24),
  /** Most unpaid checkouts one shopper (email, phone or IP) may start in an hour; 0 is no cap. */
  unpaidCheckoutsPerHour: z.number().int().min(0).max(50).default(0),
  /**
   * "Shoppers can pay with": UPI, cards, netbanking, wallets, EMI and COD, each
   * on or off, in checkout order. Unset on stores saved before it existed;
   * `checkoutMethodsOf` (./methods) fills the defaults.
   */
  methods: z.array(CheckoutMethodSchema).max(12).optional(),
  /**
   * Several gateways on at once: their fallback order and which one takes each online method
   * (./routing). Unset: the main gateway takes everything and nothing falls back.
   */
  routing: PaymentRoutingSchema.optional(),
  /** "Manual payment methods": the UPI ID and Bank transfer rows' switches and notes (./manual-rows). */
  manualRows: ManualRowsSchema.optional(),
  /** "Payment rules" (#150): hide a way to pay by order total, PIN code or product (./method-rules). */
  methodRules: PaymentMethodRulesSchema.optional(),
  /**
   * "Payment capture" (#150), per gateway id: `manual` only authorises at checkout and the
   * merchant captures from the order page. Unset is automatic. Only gateways that support it
   * (`MANUAL_CAPTURE_GATEWAYS`, ./capture) honour `manual`.
   */
  capture: z.record(z.string(), CaptureModeSchema).optional(),
  /** Set when the merchant chose "Skip for now" on the first-time payment setup. */
  setupSkippedAt: z.string().max(40).optional(),
})
export type PaymentSettings = z.infer<typeof PaymentSettingsSchema>

export const defaultPaymentSettings: PaymentSettings = {
  enabled: ['cod'],
  providers: {},
  adjustments: {},
  expireUnpaidAfterMinutes: 30,
  manualCancelAfterHours: 0,
  duplicateCheckoutHours: 24,
  unpaidCheckoutsPerHour: 0,
}

/** Auto-cancel window for unpaid manual transfer orders, in hours. */
const MANUAL_CANCEL_HOURS = { default: 6, min: 1, max: 72 } as const

/**
 * The window unpaid manual transfer orders get before they are cancelled; 0 when auto-cancel is
 * off. Off by default (owner, 8 Nov 2026): merchants match transfers by hand and mark orders
 * paid, so a timer could cancel an order that was paid but not yet marked. `manualAutoCancel`
 * 'on' turns it on (6 hours unless a window is set). Before that flag existed a positive stored
 * window meant on, so it still does. A window is clamped to 1 to 72 hours.
 */
export function manualCancelHoursOf(
  s: Pick<PaymentSettings, 'manualAutoCancel' | 'manualCancelAfterHours'>,
): number {
  if (s.manualAutoCancel === 'off') return 0
  if (s.manualAutoCancel !== 'on' && s.manualCancelAfterHours <= 0) return 0
  const hours =
    s.manualCancelAfterHours > 0 ? s.manualCancelAfterHours : MANUAL_CANCEL_HOURS.default
  return Math.min(MANUAL_CANCEL_HOURS.max, Math.max(MANUAL_CANCEL_HOURS.min, hours))
}

export function parsePaymentSettings(raw: unknown): PaymentSettings {
  const r = PaymentSettingsSchema.safeParse(raw)
  return r.success ? r.data : defaultPaymentSettings
}

// A waiting key set (`razorpay~live`) has its gateway's fields.
const fieldsOf = (registry: PaymentRegistry) => (id: string) =>
  registry.get(baseProviderId(id))?.fields

export const encryptPaymentSettings = (
  s: PaymentSettings,
  secret: string,
  registry?: PaymentRegistry,
): PaymentSettings => encryptProviderSettings(s, secret, registry ? fieldsOf(registry) : undefined)

export const decryptPaymentSettings = (
  s: PaymentSettings,
  secret: string,
  previousSecrets: string[] = [],
): PaymentSettings => decryptProviderSettings(s, secret, previousSecrets)

/** Mask secrets for the admin UI: keep the last 4 characters. */
export const maskPaymentSettings = (
  s: PaymentSettings,
  registry?: PaymentRegistry,
): PaymentSettings => maskProviderSettings(s, registry ? fieldsOf(registry) : undefined)

/** Methods every deployment has, with no adapter package: COD and manual UPI/bank transfer. */
export function builtInPaymentRegistry(): PaymentRegistry {
  return new PaymentRegistry().register(codFactory).register(manualFactory)
}

/**
 * Build the providers a store has enabled, in checkout order, from the
 * registry with that store's decrypted credentials.
 */
export function resolvePaymentProviders(
  registry: PaymentRegistry,
  settings: PaymentSettings,
  secret: string,
  previousSecrets: string[] = [],
): { providers: PaymentProvider[]; errors: string[] } {
  // previousSecrets lets a payment still be processed mid-rotation, before
  // `scripts/rotate-secrets.ts --apply` has re-encrypted this store's config
  // under the new key.
  const decrypted = decryptPaymentSettings(settings, secret, previousSecrets)
  const providers: PaymentProvider[] = []
  const errors: string[] = []
  for (const id of decrypted.enabled) {
    // A switched-off gateway never reaches checkout, even if `enabled` still lists it.
    if (isGatewayInactive(decrypted, registry.get(id)?.credentialsFrom ?? id)) continue
    const config = registry.configFor(id, decrypted.providers)
    // The manual provider shows only the rows (UPI ID, bank transfer) that are on.
    const r = registry.create(
      id,
      id === 'manual'
        ? manualConfigForCheckout(config as Record<string, string>, decrypted.manualRows)
        : config,
    )
    if (r.ok) providers.push(r.provider)
    else errors.push(`${id}: ${r.errors.join(', ')}`)
  }
  return { providers, errors }
}

export { PaymentRegistry }
