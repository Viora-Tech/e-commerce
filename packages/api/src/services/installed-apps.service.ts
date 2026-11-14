import { type AppsSettings, appInstallations, appSettingsOf } from '@commerce/core'
import { getRegistries } from '@commerce/core/registries'
import { authSchema, media, type StoreTx } from '@commerce/db'
import type { PluginSummary } from '@commerce/plugins'
import { eq, inArray, max } from 'drizzle-orm'
import { connectFormFor } from './app-connect.service'
import { storeAppsAndProviders } from './apps.service'

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

type Activity = { at: Date; summary: string | null }

/** The newer of two activities; recorded activity wins a tie since it carries the app's words. */
/**
 * An app's last error as a merchant reads it: queue internals ("job stalled more than allowable
 * limit", timeouts) become one plain line; any other message, already written for people, stays.
 */
function plainProblem(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (/stalled|timed? ?out|ETIMEDOUT|ECONNRESET/i.test(raw)) {
    return 'The last run stopped before it finished. Run it again.'
  }
  return raw
}

function newer(a: Activity | null, b: Activity | null): Activity | null {
  if (!a) return b
  if (!b) return a
  return b.at.getTime() > a.at.getTime() ? b : a
}

/** Newest stored file per storage provider: a storage app's use is the files it holds. */
async function newestMediaByProvider(tx: StoreTx, storeId: string): Promise<Map<string, Date>> {
  const rows = await tx
    .select({ provider: media.provider, at: max(media.createdAt) })
    .from(media)
    .where(eq(media.storeId, storeId))
    .groupBy(media.provider)
  return new Map(rows.flatMap((r) => (r.provider && r.at ? [[r.provider, r.at] as const] : [])))
}

/**
 * What an app did last, from what it keeps rather than only what it reported: a storage app's
 * newest file, or the app's own `lastUsed` read (newest review, signup, message). Read
 * failures never break the list; that app just falls back to its recorded activity.
 */
async function derivedActivity(
  tx: StoreTx,
  storeId: string,
  installedIds: Set<string>,
): Promise<Map<string, Activity>> {
  const { plugins } = getRegistries()
  const out = new Map<string, Activity>()
  const files = await newestMediaByProvider(tx, storeId)
  for (const p of plugins) {
    if (!installedIds.has(p.id)) continue
    for (const factory of p.provides.storage ?? []) {
      const at = files.get(factory.id)
      if (at)
        out.set(p.id, newer(out.get(p.id) ?? null, { at, summary: 'Stored a file' }) as Activity)
    }
    const lastUsed = p.lastUsed
    if (!lastUsed) continue
    // In a savepoint: a failed read must not abort the request's transaction.
    const used = await tx.transaction((sp) => lastUsed(sp, storeId)).catch(() => null)
    if (used) out.set(p.id, newer(out.get(p.id) ?? null, used) as Activity)
  }
  return out
}

/**
 * Every app this deployment ships with whether this store installed it and whether it is set up,
 * from the saved apps and the enabled provider ids alone. Pure; `storeAppSummaries` adds the
 * history and status on top, `storeAppStates` is what menus that only filter by it read.
 */
function appStates(apps: AppsSettings, connectedIds: ReadonlySet<string>) {
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
      return { ...p, installed, connected, hasCredentials, own }
    })
}

/**
 * Each app's installed and set-up state with the store's enabled provider ids, from one read of
 * the store row: what the order menus filter by, without the Installed apps list's history,
 * installers and last activity (`storeAppSummaries`).
 */
export async function storeAppStates(tx: StoreTx, storeId: string) {
  const { apps, connectedIds } = await storeAppsAndProviders(tx, storeId)
  return {
    apps: appStates(apps, connectedIds).map(({ own: _own, hasCredentials: _h, ...a }) => a),
    connectedIds,
  }
}

/**
 * Every app this deployment ships, with this store's state: installed or not, its status for
 * the Installed apps list (derived from saved accounts, the app's own setup state and recorded
 * failures), and its history (installed when and by whom, last activity).
 */
export async function storeAppSummaries(tx: StoreTx, storeId: string): Promise<StoreAppSummary[]> {
  const [{ apps, connectedIds }, history] = await Promise.all([
    storeAppsAndProviders(tx, storeId),
    appInstallations(tx, storeId),
  ])
  const userIds = [...new Set([...history.values()].flatMap((r) => r.installedBy ?? []))]
  const users = userIds.length
    ? await tx
        .select({ id: authSchema.user.id, name: authSchema.user.name })
        .from(authSchema.user)
        .where(inArray(authSchema.user.id, userIds))
    : []
  const names = new Map(users.map((u) => [u.id, u.name]))
  const { plugins } = getRegistries()
  const states = appStates(apps, connectedIds)
  const installedIds = new Set(states.filter((a) => a.installed).map((a) => a.id))
  const derived = await derivedActivity(tx, storeId, installedIds)
  return states.map(({ own, hasCredentials, ...state }) => {
    const p: PluginSummary = state
    const { installed, connected } = state
    const manifest = plugins.find((m) => m.id === p.id)
    const providerIds = providerIdsOf(p)
    const row = history.get(p.id)
    const recorded = row?.lastActivityAt
      ? { at: row.lastActivityAt, summary: row.lastActivity ?? null }
      : null
    const activity = installed ? newer(recorded, derived.get(p.id) ?? null) : null
    const problem = installed ? (plainProblem(row?.lastError) ?? own?.problem ?? null) : null
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
      lastActivity: activity?.summary ?? null,
      lastActivityAt: iso(activity?.at),
      connectsIn:
        p.kind === 'builtin' ? null : manifest && connectFormFor(manifest) ? 'flow' : 'page',
      canDisconnect: providerIds.length > 0 && hasCredentials,
    }
  })
}
