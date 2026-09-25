import { decryptSecret, encryptSecret, isEncrypted } from '../secrets'

/**
 * Shared by every "enabled providers + per-provider config" settings blob
 * (payments, shipping, notifications, storage). Fields a provider's factory
 * declares `secret: true` on are encrypted at rest and masked for the admin
 * UI; everything else is stored in clear.
 */
export type ProviderSettings = {
  enabled: string[]
  providers: Record<string, Record<string, string>>
}

/** Minimal shape of a provider factory's field declaration — just enough to know what's secret. */
export type SecretFieldLookup = (
  providerId: string,
) => { key: string; secret?: boolean }[] | undefined

/**
 * Safety net only: field NAMES matching this still get encrypted/masked even
 * if a factory forgot to set `secret: true` on them. `scripts/sweeps/secret-fields.test.ts`
 * fails when the two disagree, so this should never be the only thing catching a real secret.
 */
export const SECRET_KEY = /secret|token|password/i

const isSecretField = (
  fieldsOf: SecretFieldLookup | undefined,
  providerId: string,
  key: string,
): boolean => {
  const flagged = fieldsOf?.(providerId)?.find((f) => f.key === key)?.secret === true
  return flagged || SECRET_KEY.test(key)
}

const mapProviders = <S extends ProviderSettings>(
  s: S,
  fn: (providerId: string, key: string, value: string) => string,
): S => {
  const providers: ProviderSettings['providers'] = {}
  for (const [id, cfg] of Object.entries(s.providers)) {
    providers[id] = Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, fn(id, k, v)]))
  }
  return { ...s, providers }
}

export function encryptProviderSettings<S extends ProviderSettings>(
  s: S,
  secret: string,
  fieldsOf?: SecretFieldLookup,
): S {
  return mapProviders(s, (id, k, v) =>
    isSecretField(fieldsOf, id, k) && v && !isEncrypted(v) ? encryptSecret(v, secret) : v,
  )
}

export function decryptProviderSettings<S extends ProviderSettings>(
  s: S,
  secret: string,
  previousSecrets: string[] = [],
): S {
  return mapProviders(s, (_id, _k, v) =>
    isEncrypted(v) ? decryptSecret(v, secret, previousSecrets) : v,
  )
}

/** Mask secrets for the admin UI: keep the last 4 characters. */
export function maskProviderSettings<S extends ProviderSettings>(
  s: S,
  fieldsOf?: SecretFieldLookup,
): S {
  return mapProviders(s, (id, k, v) =>
    isSecretField(fieldsOf, id, k) && v ? `••••${v.slice(-4)}` : v,
  )
}

export const isMaskedSecret = (v: unknown): v is string =>
  typeof v === 'string' && v.startsWith('••••')
