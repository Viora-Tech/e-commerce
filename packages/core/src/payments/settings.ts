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

/** Stored on store.payments. Secret fields are encrypted before they reach the row. */
export const PaymentSettingsSchema = z.object({
  /** Methods shown at checkout, in order. 'cod' is built in; others must be registered. */
  enabled: z.array(z.string().min(1)).default(['cod']),
  providers: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  /** Optional fee or discount per method id, applied to the order total at checkout. */
  adjustments: z.record(z.string(), PaymentAdjustmentSchema).default({}),
})
export type PaymentSettings = z.infer<typeof PaymentSettingsSchema>

export const defaultPaymentSettings: PaymentSettings = {
  enabled: ['cod'],
  providers: {},
  adjustments: {},
}

export function parsePaymentSettings(raw: unknown): PaymentSettings {
  const r = PaymentSettingsSchema.safeParse(raw)
  return r.success ? r.data : defaultPaymentSettings
}

export const encryptPaymentSettings = (s: PaymentSettings, secret: string): PaymentSettings =>
  encryptProviderSettings(s, secret)

export const decryptPaymentSettings = (s: PaymentSettings, secret: string): PaymentSettings =>
  decryptProviderSettings(s, secret)

/** Mask secrets for the admin UI: keep the last 4 characters. */
export const maskPaymentSettings = (s: PaymentSettings): PaymentSettings => maskProviderSettings(s)

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
): { providers: PaymentProvider[]; errors: string[] } {
  const decrypted = decryptPaymentSettings(settings, secret)
  const providers: PaymentProvider[] = []
  const errors: string[] = []
  for (const id of decrypted.enabled) {
    const r = registry.create(id, decrypted.providers[id] ?? {})
    if (r.ok) providers.push(r.provider)
    else errors.push(`${id}: ${r.errors.join(', ')}`)
  }
  return { providers, errors }
}

export { PaymentRegistry }
