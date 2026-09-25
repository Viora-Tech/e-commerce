import { permissions } from '@commerce/core'
import { getRegistries } from '@commerce/core/registries'
import type { PluginSummary } from '@commerce/plugins'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import {
  getConnectedProviderIds,
  getStoreApps,
  installStoreApp,
  uninstallStoreApp,
} from '../services/apps.service'

const pluginId = z.object({ id: z.string().min(1).max(64) })

function requirePlugin(id: string) {
  const p = getRegistries().plugins.find((x) => x.id === id)
  if (!p) throw new ORPCError('NOT_FOUND', { message: `No plugin "${id}" in commerce.config.ts` })
  if (p.id === 'core') {
    throw new ORPCError('BAD_REQUEST', { message: 'The built-in plugin is always installed' })
  }
  return p
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

export const appsRouter = {
  /**
   * Every plugin this deployment ships, flagged with whether this store
   * installed it and, for a Connection, whether the merchant has actually
   * saved working credentials for one of its providers.
   */
  list: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const apps = await getStoreApps(context.tx, context.scope.storeId)
    const connectedIds = await getConnectedProviderIds(context.tx, context.scope.storeId)
    return getRegistries()
      .summaries()
      .map((p) => {
        const installed = p.builtIn || apps.installed.includes(p.id)
        const connected =
          p.kind === 'connection'
            ? installed && providerIdsOf(p).some((id) => connectedIds.has(id))
            : installed
        return { ...p, installed, connected }
      })
  }),

  install: can(permissions.APPS_MANAGE)
    .input(pluginId)
    .handler(({ context, input }) => {
      requirePlugin(input.id)
      return installStoreApp(context.tx, context.scope.storeId, input.id)
    }),

  uninstall: can(permissions.APPS_MANAGE)
    .input(pluginId)
    .handler(({ context, input }) => {
      requirePlugin(input.id)
      return uninstallStoreApp(context.tx, context.scope.storeId, input.id)
    }),
}
