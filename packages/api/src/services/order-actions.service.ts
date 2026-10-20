import { isPermission, type Permission } from '@commerce/core/permissions'
import type { StoreTx } from '@commerce/db'
import {
  DEFAULT_ORDER_ACTION_PERMISSION,
  type OrderAction,
  type PluginSummary,
} from '@commerce/plugins'
import { getConnectedProviderIds } from './apps.service'
import { storeAppSummaries } from './installed-apps.service'

/** One app's order actions, under its name and icon (the menus' "by app" grouping). */
export type OrderActionGroup = {
  appId: string
  appName: string
  /** The app's admin icon name; null for the default. */
  icon: string | null
  actions: OrderAction[]
}

type AppState = Pick<PluginSummary, 'id' | 'name' | 'builtIn' | 'admin'> & {
  installed: boolean
  connected: boolean
}

type GroupOptions = {
  /** Whether the member holds a permission. */
  can: (permission: Permission) => boolean
  /** Provider ids the store has switched on (a courier's Create shipment needs its courier on). */
  enabledProviderIds: ReadonlySet<string>
}

/**
 * The order actions this member can use in this store: apps that are installed and set up
 * (a connection needs its account), actions whose permission the member holds (an unknown
 * permission grants nothing), and couriers that are switched on. Apps with nothing left drop
 * out. Pure, so the rules are unit tested.
 */
export function orderActionGroups(apps: readonly AppState[], opts: GroupOptions) {
  const groups: OrderActionGroup[] = []
  for (const app of apps) {
    if (app.builtIn || !app.installed || !app.connected) continue
    const actions = app.admin.orderActions.filter((a) => {
      const needs = a.permission ?? DEFAULT_ORDER_ACTION_PERMISSION
      if (!isPermission(needs) || !opts.can(needs)) return false
      return a.handler.type !== 'shipment' || opts.enabledProviderIds.has(a.handler.providerId)
    })
    if (actions.length) {
      groups.push({ appId: app.id, appName: app.name, icon: app.admin.icon, actions })
    }
  }
  return groups
}

/** `orderActionGroups` for one store and member. */
export async function storeOrderActions(
  tx: StoreTx,
  storeId: string,
  can: (permission: Permission) => boolean,
): Promise<OrderActionGroup[]> {
  const [apps, enabledProviderIds] = await Promise.all([
    storeAppSummaries(tx, storeId),
    getConnectedProviderIds(tx, storeId),
  ])
  return orderActionGroups(apps, { can, enabledProviderIds })
}
