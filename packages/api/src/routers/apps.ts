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
        // A connection with saved working credentials counts as installed even if this
        // store saved them before "Apps → Install" existed, or connected directly from
        // Settings — otherwise the gallery shows "Install" on a gateway/courier that is
        // actively processing orders (e.g. Razorpay, Delhivery), which reads as broken.
        const hasCredentials =
          p.kind === 'connection' && providerIdsOf(p).some((id) => connectedIds.has(id))
        const installed = p.builtIn || apps.installed.includes(p.id) || hasCredentials
        const connected = p.kind === 'connection' ? hasCredentials : installed
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
