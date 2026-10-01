/**
 * SOURCE OF TRUTH KEYWORDS: readTestedFlag, setTestedFlag, loadProviderSettings, saveProviderSettings, SettingsKind
 * WHAT:  the settings-blob I/O and the "tested" localStorage flag every provider app's Connect and Overview pages share.
 * WHY:   one owner instead of a copy per courier and Decentro; the flag is cosmetic only (the
 *        Overview's "tested" badge), never trusted for anything that matters.
 * WHERE: ProviderConnectPage, ProviderOverviewPage and the Decentro Connect wrapper.
 */
import type { ProviderDef, ProviderState } from '@/components/settings/provider-settings-form'
import { api } from '@/lib/api-client'

/** Which store settings blob the provider lives in: couriers in shipping, Decentro in payments. */
export type SettingsKind = 'shipping' | 'payments'

export type SettingsBlob = ProviderState & Record<string, unknown>

export type FieldValues = Record<string, string>

const testedFlagKey = (providerId: string) => `${providerId}-connect-tested`

/** Set by the Connect page after a passing "Test connection". Blocked or private-browsing
 *  storage just means the badge doesn't show. */
export function readTestedFlag(providerId: string): boolean {
  try {
    return localStorage.getItem(testedFlagKey(providerId)) === 'true'
  } catch {
    return false
  }
}

export function setTestedFlag(providerId: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(testedFlagKey(providerId), 'true')
    else localStorage.removeItem(testedFlagKey(providerId))
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
