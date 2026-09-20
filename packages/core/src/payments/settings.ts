import { type PaymentProvider, PaymentRegistry } from '@commerce/payments'
import { z } from 'zod'
import { CodPaymentProvider } from '../providers/cod'
import { decryptSecret, encryptSecret, isEncrypted } from '../secrets'

/** Stored on store.payments. Secret fields are encrypted before they reach the row. */
export const PaymentSettingsSchema = z.object({
  /** Methods shown at checkout, in order. 'cod' is built in; others must be registered. */
  enabled: z.array(z.string().min(1)).default(['cod']),
  providers: z.record(z.string(), z.record(z.string(), z.string())).default({}),
})
export type PaymentSettings = z.infer<typeof PaymentSettingsSchema>

export const defaultPaymentSettings: PaymentSettings = { enabled: ['cod'], providers: {} }

export function parsePaymentSettings(raw: unknown): PaymentSettings {
  const r = PaymentSettingsSchema.safeParse(raw)
  return r.success ? r.data : defaultPaymentSettings
}

/** Field names that must never be stored in clear. Adapters name their secrets with these suffixes. */
const SECRET_KEY = /secret|token|password/i

export function encryptPaymentSettings(s: PaymentSettings, secret: string): PaymentSettings {
  const providers: PaymentSettings['providers'] = {}
  for (const [id, cfg] of Object.entries(s.providers)) {
    providers[id] = Object.fromEntries(
      Object.entries(cfg).map(([k, v]) => [
        k,
        SECRET_KEY.test(k) && v && !isEncrypted(v) ? encryptSecret(v, secret) : v,
      ]),
    )
  }
  return { ...s, providers }
}

export function decryptPaymentSettings(s: PaymentSettings, secret: string): PaymentSettings {
  const providers: PaymentSettings['providers'] = {}
  for (const [id, cfg] of Object.entries(s.providers)) {
    providers[id] = Object.fromEntries(
      Object.entries(cfg).map(([k, v]) => [k, isEncrypted(v) ? decryptSecret(v, secret) : v]),
    )
  }
  return { ...s, providers }
}

/** Mask secrets for the admin UI: keep the last 4 characters. */
export function maskPaymentSettings(s: PaymentSettings): PaymentSettings {
  const providers: PaymentSettings['providers'] = {}
  for (const [id, cfg] of Object.entries(s.providers)) {
    providers[id] = Object.fromEntries(
      Object.entries(cfg).map(([k, v]) => [k, SECRET_KEY.test(k) && v ? `••••${v.slice(-4)}` : v]),
    )
  }
  return { ...s, providers }
}

/**
 * Build the providers a store has enabled. COD needs no config. Anything else
 * comes from the registry with that store's decrypted credentials.
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
    if (id === 'cod') {
      providers.push(new CodPaymentProvider())
      continue
    }
    const r = registry.create(id, decrypted.providers[id])
    if (r.ok) providers.push(r.provider)
    else errors.push(`${id}: ${r.errors.join(', ')}`)
  }
  return { providers, errors }
}

export { PaymentRegistry }
