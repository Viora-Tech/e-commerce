import {
  type AppsSettings,
  installApp,
  parseAppsSettings,
  parseNotificationSettings,
  parsePaymentSettings,
  parseShippingSettings,
  uninstallApp,
} from '@commerce/core'
import { getRegistries, registriesForStore } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import type { Registries } from '@commerce/plugins'
import { eq } from 'drizzle-orm'

export async function getStoreApps(tx: StoreTx, storeId: string): Promise<AppsSettings> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  return parseAppsSettings(s?.apps)
}

/** Registries limited to what this store installed; see registriesForStore. */
export const storeRegistries = (tx: StoreTx, storeId: string): Promise<Registries> =>
  registriesForStore(tx, storeId)

export async function installStoreApp(tx: StoreTx, storeId: string, pluginId: string) {
  const next = installApp(await getStoreApps(tx, storeId), pluginId)
  await tx.update(store).set({ apps: next }).where(eq(store.id, storeId))
  return next
}

/**
 * Uninstall removes the plugin's providers from every `enabled` list so
 * nothing keeps routing to it. Credentials stay in the settings row: a
 * reinstall picks up where the merchant left off.
 */
export async function uninstallStoreApp(tx: StoreTx, storeId: string, pluginId: string) {
  const [s] = await tx.select().from(store).where(eq(store.id, storeId))
  if (!s) return null
  const ids = getRegistries().providerIds(pluginId)
  const drop = (enabled: string[], gone: string[]) => enabled.filter((id) => !gone.includes(id))
  const payments = parsePaymentSettings(s.payments)
  const shipping = parseShippingSettings(s.shipping)
  const notifications = parseNotificationSettings(s.notifications)
  const apps = uninstallApp(parseAppsSettings(s.apps), pluginId)
  await tx
    .update(store)
    .set({
      apps,
      payments: { ...payments, enabled: drop(payments.enabled, ids.payments) },
      shipping: { ...shipping, enabled: drop(shipping.enabled, ids.shipping) },
      notifications: { ...notifications, enabled: drop(notifications.enabled, ids.notifications) },
    })
    .where(eq(store.id, storeId))
  return apps
}
