/** SOURCE OF TRUTH: app install history — WHAT: when and by whom each app was installed, its last activity and last failure (app_installation) / WHY: the Installed apps list and permissions sheet show them */
import { appInstallation, order, type StoreTx } from '@commerce/db'
import { CORE_PLUGIN_ID, type LoadedPlugins } from '@commerce/plugins'
import { and, eq, sql } from 'drizzle-orm'

type ProviderOwners = LoadedPlugins['owners']

/** Activity and error text is shown in one table cell: keep what an app says short. */
const MAX_TEXT = 200

const clip = (text: string | null): string | null =>
  text === null ? null : text.trim().slice(0, MAX_TEXT) || null

/**
 * Note an install: when and by whom. A reinstall starts a fresh row (uninstall deletes it), so
 * the date is the latest install. An app installed twice in a row keeps its first date.
 */
export async function recordAppInstall(
  tx: StoreTx,
  storeId: string,
  pluginId: string,
  userId: string | null,
  now: Date = new Date(),
): Promise<void> {
  await tx
    .insert(appInstallation)
    .values({ storeId, pluginId, installedAt: now, installedBy: userId })
    .onConflictDoUpdate({
      target: [appInstallation.storeId, appInstallation.pluginId],
      set: {
        installedAt: sql`coalesce(${appInstallation.installedAt}, excluded.installed_at)`,
        installedBy: sql`coalesce(${appInstallation.installedBy}, excluded.installed_by)`,
      },
    })
}

/** Forget an app's history on uninstall. */
export async function removeAppInstall(tx: StoreTx, storeId: string, pluginId: string) {
  await tx
    .delete(appInstallation)
    .where(and(eq(appInstallation.storeId, storeId), eq(appInstallation.pluginId, pluginId)))
}

/**
 * What an app just did, for the Installed list's "Last activity". `summary` is the app's own
 * words ("Issued invoice INV-2041"); null means it did something without saying what. Success
 * also clears an error recorded earlier from the same kind of work when `clearError` is set.
 */
export async function recordAppActivity(
  tx: StoreTx,
  storeId: string,
  pluginId: string,
  summary: string | null,
  opts: { clearError?: boolean; now?: Date } = {},
): Promise<void> {
  const now = opts.now ?? new Date()
  const text = clip(summary)
  await tx
    .insert(appInstallation)
    .values({ storeId, pluginId, lastActivity: text, lastActivityAt: now })
    .onConflictDoUpdate({
      target: [appInstallation.storeId, appInstallation.pluginId],
      set: {
        lastActivity: text,
        lastActivityAt: now,
        ...(opts.clearError ? { lastError: null, lastErrorAt: null } : {}),
      },
    })
}

/** A failure the merchant should see on the Installed list (status Error) until it is cleared. */
export async function recordAppError(
  tx: StoreTx,
  storeId: string,
  pluginId: string,
  message: string,
  now: Date = new Date(),
): Promise<void> {
  const text = clip(message) ?? 'Failed'
  await tx
    .insert(appInstallation)
    .values({ storeId, pluginId, lastError: text, lastErrorAt: now })
    .onConflictDoUpdate({
      target: [appInstallation.storeId, appInstallation.pluginId],
      set: { lastError: text, lastErrorAt: now },
    })
}

export type AppInstallationRow = typeof appInstallation.$inferSelect

/** Every history row of a store, keyed by plugin id. */
export async function appInstallations(
  tx: StoreTx,
  storeId: string,
): Promise<Map<string, AppInstallationRow>> {
  const rows = await tx.select().from(appInstallation).where(eq(appInstallation.storeId, storeId))
  return new Map(rows.map((r) => [r.pluginId, r]))
}

/**
 * Last activity for the app behind a provider (a courier booking, a gateway payment). `owners`
 * is the loaded plugins' provider map; a core provider (COD, the demo courier) has no app row.
 */
export async function recordProviderActivity(
  tx: StoreTx,
  storeId: string,
  owners: ProviderOwners,
  kind: keyof ProviderOwners,
  providerId: string,
  summary: string,
): Promise<void> {
  const pluginId = owners[kind][providerId]
  if (!pluginId || pluginId === CORE_PLUGIN_ID) return
  await recordAppActivity(tx, storeId, pluginId, summary)
}

/** `#1187` for an order id, as shoppers and staff see it; null when the order is gone. */
export async function orderNumberLabel(tx: StoreTx, orderId: string): Promise<string | null> {
  const [o] = await tx.select({ number: order.number }).from(order).where(eq(order.id, orderId))
  return o ? `#${o.number}` : null
}
