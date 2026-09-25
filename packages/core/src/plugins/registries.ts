import type { AppBlockSource } from '@commerce/blocks/puck'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import { CORE_PLUGIN_ID, type LoadedPlugins, loadPlugins, type Registries } from '@commerce/plugins'
import { eq } from 'drizzle-orm'
import commerceConfig from '../../../../commerce.config'
import { parseAppsSettings } from '../apps/settings'
import { corePlugin } from './core-plugin'

let loaded: LoadedPlugins | null = null

/**
 * The one place the deployment's plugins are assembled: the core plugin
 * plus whatever commerce.config.ts lists. Apps and the API call this; nothing
 * else imports an adapter package. Server only — the root config pulls in
 * every adapter's runtime.
 */
export function getRegistries(): LoadedPlugins {
  loaded ??= loadPlugins([corePlugin, ...commerceConfig.plugins])
  return loaded
}

/**
 * Registries limited to what one store installed (Admin → Apps). Every
 * provider lookup for a store goes through here, so an app the merchant
 * never installed cannot be enabled, charged through or shipped with.
 */
export async function registriesForStore(tx: StoreTx, storeId: string): Promise<Registries> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  return getRegistries().forStore(parseAppsSettings(s?.apps).installed)
}

/**
 * Every deployment plugin as an `AppBlockSource` (for `buildAppBlocks`), plus
 * which of them this store has enabled. Always includes the core plugin — it
 * cannot be uninstalled. Used to build the storefront's live app-blocks
 * config; see `apps/storefront/src/lib/template-render.tsx`.
 */
export async function appBlockSourcesForStore(
  tx: StoreTx,
  storeId: string,
): Promise<{ allSources: AppBlockSource[]; enabledIds: Set<string> }> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  const enabledIds = new Set([CORE_PLUGIN_ID, ...parseAppsSettings(s?.apps).installed])
  const allSources: AppBlockSource[] = getRegistries().plugins.map((p) => ({
    id: p.id,
    name: p.name,
    icon: p.admin?.icon,
    blocks: p.storefront?.blocks,
  }))
  return { allSources, enabledIds }
}
