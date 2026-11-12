/**
 * SOURCE OF TRUTH KEYWORDS: readTestedFlag, setTestedFlag, loadProviderSettings, saveProviderSettings, SettingsKind
 * WHAT:  the settings-blob I/O and the "tested" localStorage flag every provider app's Connect and Overview pages share.
 * WHY:   one owner instead of a copy per courier and Decentro; the flag is cosmetic only (the
 *        Overview's "tested" badge), never trusted for anything that matters.
 * WHERE: ProviderConnectPage, ProviderOverviewPage and the Decentro Connect wrapper.
 */
import type { ProviderDef, ProviderState } from '@/components/settings/provider-settings-form'
import { api } from '@/lib/api-client'
import { type StorageScope, scopedStorageKey } from '@/lib/storage-scope'

/** Which store settings blob the provider lives in: couriers in shipping, Decentro in payments. */
export type SettingsKind = 'shipping' | 'payments'

export type SettingsBlob = ProviderState & Record<string, unknown>

export type FieldValues = Record<string, string>

/** One flag per store: the badge is about that store's connection, whoever tested it. */
const testedFlagKey = (scope: StorageScope | null, providerId: string) =>
  scopedStorageKey(`connect-tested:${providerId}`, scope, { perUser: false })

/** Set by the Connect page after a passing "Test connection". Blocked or private-browsing
 *  storage (or no store picked) just means the badge doesn't show. */
export function readTestedFlag(scope: StorageScope | null, providerId: string): boolean {
  const key = testedFlagKey(scope, providerId)
  if (!key) return false
  try {
    return localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

export function setTestedFlag(scope: StorageScope | null, providerId: string, on: boolean): void {
  const key = testedFlagKey(scope, providerId)
  if (!key) return
  try {
    if (on) localStorage.setItem(key, 'true')
    else localStorage.removeItem(key)
  } catch {
    // Blocked storage: the Overview badge just won't show. Not fatal.
  }
}

export async function loadProviderSettings(
  kind: SettingsKind,
): Promise<{ settings: SettingsBlob; available: ProviderDef[] }> {
  const r = kind === 'shipping' ? await api.store.getShipping() : await api.store.getPayments()
  return { settings: r.settings as SettingsBlob, available: r.available }
}

export async function saveProviderSettings(
  kind: SettingsKind,
  next: SettingsBlob,
): Promise<SettingsBlob | null> {
  const result =
    kind === 'shipping'
      ? await api.store.updateShipping(next)
      : await api.store.updatePayments(next)
  return result as SettingsBlob | null
}
