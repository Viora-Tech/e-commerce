import { NotificationRegistry } from '@commerce/notifications'
import { PaymentRegistry } from '@commerce/payments'
import { ShippingRegistry } from '@commerce/shipping'
import type { PluginManifest, PluginSummary, ProviderKind } from './types'

export type Registries = {
  payments: PaymentRegistry
  shipping: ShippingRegistry
  notifications: NotificationRegistry
}

/** Which plugin contributed a provider id, per kind. Lets settings pages link back to the app. */
export type ProviderOwners = Record<ProviderKind, Record<string, string>>

export type LoadedPlugins = Registries & {
  plugins: PluginManifest[]
  owners: ProviderOwners
  /** Serialisable manifests for the admin Apps page. */
  summaries(): PluginSummary[]
  /**
   * Registries restricted to the core plugin plus the plugins a store has
   * installed. Everything that resolves providers for one store goes through
   * this, so an uninstalled app's gateway can never be enabled by accident.
   */
  forStore(installed: readonly string[]): Registries
  /** Provider ids a plugin contributes, per kind; used to clean up settings on uninstall. */
  providerIds(pluginId: string): Record<ProviderKind, string[]>
}

export const CORE_PLUGIN_ID = 'core'

const KINDS: ProviderKind[] = ['payments', 'shipping', 'notifications']

function buildRegistries(plugins: PluginManifest[]): Registries {
  const r: Registries = {
    payments: new PaymentRegistry(),
    shipping: new ShippingRegistry(),
    notifications: new NotificationRegistry(),
  }
  for (const p of plugins) {
    for (const f of p.provides.payments ?? []) r.payments.register(f)
    for (const f of p.provides.shipping ?? []) r.shipping.register(f)
    for (const f of p.provides.notifications ?? []) r.notifications.register(f)
  }
  return r
}

/** Fail loudly on two plugins claiming the same id, or the same provider id within a kind. */
function checkDuplicates(plugins: PluginManifest[]): ProviderOwners {
  const seenPlugin = new Map<string, PluginManifest>()
  const owners: ProviderOwners = { payments: {}, shipping: {}, notifications: {} }
  for (const p of plugins) {
    const prior = seenPlugin.get(p.id)
    if (prior) {
      throw new Error(
        `duplicate plugin id "${p.id}": "${prior.name}" v${prior.version} and "${p.name}" v${p.version}`,
      )
    }
    seenPlugin.set(p.id, p)
    for (const kind of KINDS) {
      for (const f of p.provides[kind] ?? []) {
        const owner = owners[kind][f.id]
        if (owner) {
          throw new Error(
            `${kind} provider "${f.id}" is provided by both plugin "${owner}" and plugin "${p.id}"`,
          )
        }
        owners[kind][f.id] = p.id
      }
    }
  }
  return owners
}

/**
 * Turn the plugin list into registries. The first plugin is expected to be
 * the core plugin (built-ins); callers that assemble the list from
 * commerce.config.ts prepend it. Throws on duplicate ids so a bad
 * deployment config fails at boot, never at checkout.
 */
export function loadPlugins(plugins: PluginManifest[]): LoadedPlugins {
  const owners = checkDuplicates(plugins)
  const all = buildRegistries(plugins)
  const byId = new Map(plugins.map((p) => [p.id, p]))

  return {
    ...all,
    plugins,
    owners,
    summaries: () =>
      plugins.map((p) => ({
        id: p.id,
        name: p.name,
        version: p.version,
        description: p.description ?? null,
        builtIn: p.id === CORE_PLUGIN_ID,
        provides: {
          payments: (p.provides.payments ?? []).map((f) => ({ id: f.id, label: f.label })),
          shipping: (p.provides.shipping ?? []).map((f) => ({ id: f.id, label: f.label })),
          notifications: (p.provides.notifications ?? []).map((f) => ({
            id: f.id,
            label: f.label,
          })),
        },
      })),
    forStore: (installed) => {
      const allowed = new Set([CORE_PLUGIN_ID, ...installed])
      return buildRegistries(plugins.filter((p) => allowed.has(p.id)))
    },
    providerIds: (pluginId) => {
      const p = byId.get(pluginId)
      return {
        payments: (p?.provides.payments ?? []).map((f) => f.id),
        shipping: (p?.provides.shipping ?? []).map((f) => f.id),
        notifications: (p?.provides.notifications ?? []).map((f) => f.id),
      }
    },
  }
}
