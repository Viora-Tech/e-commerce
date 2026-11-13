import {
  type AppsSettings,
  installApp,
  lockStoreApps,
  parseAppsSettings,
  parseNotificationSettings,
  parsePaymentSettings,
  parseShippingSettings,
  parseStorageSettings,
  recordAppInstall,
  removeAppInstall,
  uninstallApp,
} from '@commerce/core'
import { pauseWorkflowsForRemovedApp } from '@commerce/core/automations/server'
import { getRegistries, registriesForStore } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import type { Registries } from '@commerce/plugins'
import { eq } from 'drizzle-orm'

export async function getStoreApps(tx: StoreTx, storeId: string): Promise<AppsSettings> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  return parseAppsSettings(s?.apps)
}

/**
 * The store's saved apps and the provider ids it has actually enabled, across every kind, from
 * one read of the store row and only the columns they come from (the row also holds the theme,
 * navigation and other wide settings). A Connection app's card shows "connected" only when one
 * of its own provider ids is enabled: installing the app alone is not enough, the merchant must
 * have filled in and saved the account's credentials.
 */
export async function storeAppsAndProviders(
  tx: StoreTx,
  storeId: string,
): Promise<{ apps: AppsSettings; connectedIds: Set<string> }> {
  const [s] = await tx
    .select({
      apps: store.apps,
      payments: store.payments,
      shipping: store.shipping,
      notifications: store.notifications,
      storage: store.storage,
    })
    .from(store)
    .where(eq(store.id, storeId))
  if (!s) return { apps: parseAppsSettings(undefined), connectedIds: new Set() }
  return {
    apps: parseAppsSettings(s.apps),
    connectedIds: new Set([
      ...parsePaymentSettings(s.payments).enabled,
      ...parseShippingSettings(s.shipping).enabled,
      ...parseNotificationSettings(s.notifications).enabled,
      ...parseStorageSettings(s.storage).enabled,
    ]),
  }
}

/** Registries limited to what this store installed; see registriesForStore. */
export const storeRegistries = (tx: StoreTx, storeId: string): Promise<Registries> =>
  registriesForStore(tx, storeId)

export async function installStoreApp(
  tx: StoreTx,
  storeId: string,
  pluginId: string,
  userId: string | null = null,
) {
  const next = installApp(await lockStoreApps(tx, storeId), pluginId)
  await tx.update(store).set({ apps: next }).where(eq(store.id, storeId))
  await recordAppInstall(tx, storeId, pluginId, userId)
  return next
}

/** The store's settings blobs with one app's providers taken out of every `enabled` list. */
function withoutProviders(s: typeof store.$inferSelect, pluginId: string) {
  const ids = getRegistries().providerIds(pluginId)
  const drop = (enabled: string[], gone: string[]) => enabled.filter((id) => !gone.includes(id))
  const payments = parsePaymentSettings(s.payments)
  const shipping = parseShippingSettings(s.shipping)
  const notifications = parseNotificationSettings(s.notifications)
  const storage = parseStorageSettings(s.storage)
  return {
    payments: { ...payments, enabled: drop(payments.enabled, ids.payments) },
    shipping: { ...shipping, enabled: drop(shipping.enabled, ids.shipping) },
    notifications: { ...notifications, enabled: drop(notifications.enabled, ids.notifications) },
    storage: { ...storage, enabled: drop(storage.enabled, ids.storage) },
  }
}

/**
 * Uninstall removes the plugin's providers from every `enabled` list so
 * nothing keeps routing to it. Credentials stay in the settings row: a
 * reinstall picks up where the merchant left off.
 */
export async function uninstallStoreApp(tx: StoreTx, storeId: string, pluginId: string) {
  const locked = await lockStoreApps(tx, storeId)
  const [s] = await tx.select().from(store).where(eq(store.id, storeId))
  if (!s) return null
  const apps = uninstallApp(locked, pluginId)
  await tx
    .update(store)
    .set({ apps, ...withoutProviders(s, pluginId) })
    .where(eq(store.id, storeId))
  await removeAppInstall(tx, storeId, pluginId)
  // Workflows that use the app's triggers or actions stop, with a note saying why.
  const name = getRegistries().plugins.find((p) => p.id === pluginId)?.name ?? pluginId
  await pauseWorkflowsForRemovedApp(tx, pluginId, name)
  return apps
}

/**
 * "Disconnect": switch the app's providers off so nothing routes to its account any more. The
 * app stays installed (Needs setup) and its saved credentials stay, like an uninstall, so
 * connecting again picks up where the merchant left off.
 */
export async function disconnectStoreApp(tx: StoreTx, storeId: string, pluginId: string) {
  const locked = await lockStoreApps(tx, storeId)
  const [s] = await tx.select().from(store).where(eq(store.id, storeId))
  if (!s) return
  // An app counted as installed only through its saved account (connected from Settings before
  // Apps existed) is put on the install list, so disconnecting never makes it vanish.
  const apps = installApp(locked, pluginId)
  await tx
    .update(store)
    .set({ apps, ...withoutProviders(s, pluginId) })
    .where(eq(store.id, storeId))
}
