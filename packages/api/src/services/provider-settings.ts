import {
  decryptProviderSettings,
  encryptProviderSettings,
  isEncryptedSecret,
  isMaskedSecret,
  maskProviderSettings,
  type ProviderSettings,
} from '@commerce/core'
import type { ProviderField } from '@commerce/payments'
import { ORPCError } from '@orpc/server'

/** What both registries (payments, notifications) expose; enough to validate a config. */
type FactoryLookup = {
  ids(): string[]
  get(id: string):
    | {
        label: string
        fields: ProviderField[]
        validateConfig(raw: unknown): { ok: true } | { ok: false; errors: string[] }
      }
    | undefined
}

export type AvailableProvider = { id: string; label: string; fields: ProviderField[] }

/** The provider list the admin form renders; nothing about a provider is hard-coded there. */
export function availableProviders(registry: FactoryLookup): AvailableProvider[] {
  return registry.ids().map((id) => {
    const f = registry.get(id)
    return { id, label: f?.label ?? id, fields: f?.fields ?? [] }
  })
}

/** Decrypt then mask, so the UI sees ••••last4 of the real value, never of the ciphertext. */
export function presentProviderSettings<S extends ProviderSettings>(s: S, secret: string): S {
  return maskProviderSettings(decryptProviderSettings(s, secret))
}

/**
 * Turn a form submission into what gets stored. A masked secret (••••1234)
 * means "unchanged" and the stored encrypted value is kept; every enabled
 * provider is validated by its factory; the result is encrypted.
 */
export function prepareProviderSettings<S extends ProviderSettings>(
  input: S,
  current: S,
  registry: FactoryLookup,
  secret: string,
  kind: string,
): S {
  const merged = { ...input, providers: { ...input.providers } }
  for (const [id, cfg] of Object.entries(merged.providers)) {
    const prev = current.providers[id] ?? {}
    merged.providers[id] = Object.fromEntries(
      Object.entries(cfg).map(([k, v]) => [
        k,
        isMaskedSecret(v) && (isEncryptedSecret(prev[k]) || prev[k]) ? (prev[k] as string) : v,
      ]),
    )
  }
  for (const id of merged.enabled) {
    const f = registry.get(id)
    if (!f) throw new ORPCError('BAD_REQUEST', { message: `Unknown ${kind} ${id}` })
    // Validators see a placeholder for encrypted values; they only check presence and shape.
    const check = f.validateConfig(
      Object.fromEntries(
        Object.entries(merged.providers[id] ?? {}).map(([k, v]) => [
          k,
          isEncryptedSecret(v) ? 'x'.repeat(8) : v,
        ]),
      ),
    )
    if (!check.ok) {
      throw new ORPCError('BAD_REQUEST', { message: `${f.label}: ${check.errors.join(', ')}` })
    }
  }
  return encryptProviderSettings(merged, secret)
}
