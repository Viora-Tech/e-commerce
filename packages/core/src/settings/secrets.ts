import { decryptSecret, encryptSecret, isEncrypted } from '../secrets'

/**
 * Shared by every "enabled providers + per-provider config" settings blob
 * (payments, notifications). Secret-looking keys are encrypted at rest and
 * masked for the admin UI; everything else is stored in clear.
 */
export type ProviderSettings = {
  enabled: string[]
  providers: Record<string, Record<string, string>>
}

/** Field names that must never be stored in clear. Adapters name their secrets with these words. */
export const SECRET_KEY = /secret|token|password/i

const mapProviders = <S extends ProviderSettings>(
  s: S,
  fn: (key: string, value: string) => string,
): S => {
  const providers: ProviderSettings['providers'] = {}
  for (const [id, cfg] of Object.entries(s.providers)) {
    providers[id] = Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, fn(k, v)]))
  }
  return { ...s, providers }
}

export function encryptProviderSettings<S extends ProviderSettings>(s: S, secret: string): S {
  return mapProviders(s, (k, v) =>
    SECRET_KEY.test(k) && v && !isEncrypted(v) ? encryptSecret(v, secret) : v,
  )
}

export function decryptProviderSettings<S extends ProviderSettings>(s: S, secret: string): S {
  return mapProviders(s, (_k, v) => (isEncrypted(v) ? decryptSecret(v, secret) : v))
}

/** Mask secrets for the admin UI: keep the last 4 characters. */
export function maskProviderSettings<S extends ProviderSettings>(s: S): S {
  return mapProviders(s, (k, v) => (SECRET_KEY.test(k) && v ? `••••${v.slice(-4)}` : v))
}

export const isMaskedSecret = (v: unknown): v is string =>
  typeof v === 'string' && v.startsWith('••••')
