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
import { CheckoutMethodSchema } from './methods'

/** Stored on store.payments. Secret fields are encrypted before they reach the row. */
export const PaymentSettingsSchema = z.object({
  /** Methods shown at checkout, in order. 'cod' is built in; others must be registered. */
  enabled: z.array(z.string().min(1)).default(['cod']),
  providers: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  /** Optional fee or discount per method id, applied to the order total at checkout. */
  adjustments: z.record(z.string(), PaymentAdjustmentSchema).default({}),
  /**
   * Cancel online-payment orders still unpaid after this many minutes and
   * release their stock. 0 turns it off. COD and manual transfers never expire.
   */
  expireUnpaidAfterMinutes: z.number().int().min(0).max(10_080).default(30),
  /**
   * Cancel manual UPI / bank transfer orders still unpaid this many hours
   * after they were placed, releasing their stock. Off (0) by default: the
   * shopper may have paid and the merchant not matched it yet. When on, the
   * merchant is told 12 hours before; marking the order paid stops it.
   */
  manualCancelAfterHours: z.number().int().min(0).max(720).default(0),
  /**
   * "Shoppers can pay with": UPI, cards, netbanking, wallets, EMI and COD, each
   * on or off, in checkout order. Unset on stores saved before it existed;
   * `checkoutMethodsOf` (./methods) fills the defaults.
   */
  methods: z.array(CheckoutMethodSchema).max(12).optional(),
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
}

export function parsePaymentSettings(raw: unknown): PaymentSettings {
  const r = PaymentSettingsSchema.safeParse(raw)
  return r.success ? r.data : defaultPaymentSettings
}

const fieldsOf = (registry: PaymentRegistry) => (id: string) => registry.get(id)?.fields

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
    const r = registry.create(id, registry.configFor(id, decrypted.providers))
    if (r.ok) providers.push(r.provider)
    else errors.push(`${id}: ${r.errors.join(', ')}`)
  }
  return { providers, errors }
}

export { PaymentRegistry }
