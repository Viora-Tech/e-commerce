import { appInstallations, appSettingsOf } from '@commerce/core'
import { getRegistries } from '@commerce/core/registries'
import { authSchema, type StoreTx } from '@commerce/db'
import type { PluginSummary } from '@commerce/plugins'
import { inArray } from 'drizzle-orm'
import { connectFormFor } from './app-connect.service'
import { getConnectedProviderIds, getStoreApps } from './apps.service'

/** Connected: working. Needs setup: installed but no account yet. Error: a recorded failure. */
export type AppStatus = 'connected' | 'needsSetup' | 'error'

export type StoreAppSummary = PluginSummary & {
  installed: boolean
  /** For a `connection`: installed AND the merchant has saved working credentials for it. */
  connected: boolean
  /** Null when not installed. */
  status: AppStatus | null
  /** The failure behind `error`, in words. */
  problem: string | null
  /** Null for an app installed before install dates were kept. */
  installedAt: string | null
  /** Who installed it; null when unknown. */
  installedBy: string | null
  lastActivity: string | null
  lastActivityAt: string | null
  /** The account the install flow connects in its first step; null when the app connects on its own page. */
  connectsIn: 'flow' | 'page' | null
  /** The app's providers can be switched off without uninstalling ("Disconnect"). */
  canDisconnect: boolean
}

/** Every provider id a plugin contributes, across every kind. */
function providerIdsOf(p: PluginSummary): string[] {
  return [
    ...p.provides.payments,
    ...p.provides.shipping,
    ...p.provides.notifications,
    ...p.provides.storage,
  ].map((x) => x.id)
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

/**
 * Every app this deployment ships, with this store's state: installed or not, its status for
 * the Installed apps list (derived from saved accounts, the app's own setup state and recorded
 * failures), and its history (installed when and by whom, last activity).
 */
export async function storeAppSummaries(tx: StoreTx, storeId: string): Promise<StoreAppSummary[]> {
  const apps = await getStoreApps(tx, storeId)
  const connectedIds = await getConnectedProviderIds(tx, storeId)
  const history = await appInstallations(tx, storeId)
  const userIds = [...new Set([...history.values()].flatMap((r) => r.installedBy ?? []))]
  const users = userIds.length
    ? await tx
        .select({ id: authSchema.user.id, name: authSchema.user.name })
        .from(authSchema.user)
        .where(inArray(authSchema.user.id, userIds))
    : []
  const names = new Map(users.map((u) => [u.id, u.name]))
  const { plugins } = getRegistries()
  return getRegistries()
    .summaries()
    .map((p) => {
      const manifest = plugins.find((m) => m.id === p.id)
      const providerIds = providerIdsOf(p)
      // A connection with saved working credentials counts as installed even if this store
      // saved them before "Apps → Install" existed, or connected directly from Settings —
      // otherwise the list shows "Install" on a gateway or courier that is taking orders.
      const hasCredentials =
        p.kind === 'connection' && providerIds.some((id) => connectedIds.has(id))
      const installed = p.builtIn || apps.installed.includes(p.id) || hasCredentials
      const own = manifest?.setupState?.(appSettingsOf(apps, p.id)) ?? null
      const connected =
        p.kind === 'builtin'
          ? installed
          : providerIds.length > 0
            ? hasCredentials
            : (own?.connected ?? installed)
      const row = history.get(p.id)
      const problem = installed ? (row?.lastError ?? own?.problem ?? null) : null
      const status: AppStatus | null = !installed
        ? null
        : problem
          ? 'error'
          : connected
            ? 'connected'
            : 'needsSetup'
      return {
        ...p,
        installed,
        connected,
        status,
        problem,
        installedAt: iso(row?.installedAt),
        installedBy: row?.installedBy ? (names.get(row.installedBy) ?? null) : null,
        lastActivity: row?.lastActivity ?? null,
        lastActivityAt: iso(row?.lastActivityAt),
        connectsIn:
          p.kind === 'builtin' ? null : manifest && connectFormFor(manifest) ? 'flow' : 'page',
        canDisconnect: providerIds.length > 0 && hasCredentials,
      }
    })
}
