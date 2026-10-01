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

/**
 * Connector fields that decide where requests (and so the stored secrets) are sent: the
 * couriers' `baseUrl`, R2's `accountId` (it is the endpoint's host), a storage `bucket`
 * (a store on the platform's default R2 keys must not point them at another bucket), a
 * generic `endpoint`.
 */
const DESTINATION_KEYS = new Set(['baseUrl', 'endpoint', 'host', 'accountId', 'bucket'])

/**
 * Fill masked secrets (`••••1234`, "unchanged") from the stored values. Refused when a
 * masked secret is kept while a destination field (`baseUrl`, `endpoint`, …) moves: the
 * stored token would otherwise go to whatever address the caller typed, without the caller
 * ever having seen it. Changing the address means typing the secret again.
 */
export function mergeMaskedSecrets(
  stored: Record<string, string | undefined>,
  raw: Record<string, string>,
): { ok: true; merged: Record<string, string> } | { ok: false; field: string } {
  const keepsStoredSecret = Object.entries(raw).some(([k, v]) => isMaskedSecret(v) && stored[k])
  if (keepsStoredSecret) {
    const keys = new Set([...Object.keys(raw), ...Object.keys(stored)])
    for (const key of keys) {
      if (!DESTINATION_KEYS.has(key) || isMaskedSecret(raw[key])) continue
      const before = (stored[key] ?? '').trim()
      const after = (key in raw ? (raw[key] ?? '') : before).trim()
      if (before !== after) return { ok: false, field: key }
    }
  }
  const merged = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, (isMaskedSecret(v) && stored[k]) || v]),
  )
  return { ok: true, merged }
}
