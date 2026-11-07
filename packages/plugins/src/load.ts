import { type Attachment, NotificationRegistry, type TemplateId } from '@commerce/notifications'
import { PaymentRegistry } from '@commerce/payments'
import { ShippingRegistry } from '@commerce/shipping'
import { StorageRegistry } from '@commerce/storage'
import { orderActionsOf } from './order-actions'
import type {
  AppEvent,
  AppHook,
  AppHookContext,
  AppJob,
  AppJobFailed,
  OrderLink,
  OrderLinkContext,
  PluginManifest,
  PluginSummary,
  ProviderKind,
} from './types'

export type Registries = {
  payments: PaymentRegistry
  shipping: ShippingRegistry
  notifications: NotificationRegistry
  storage: StorageRegistry
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
  /** Hooks for one event from the plugins a store installed, in config order. */
  hooksFor(event: AppEvent, installed: readonly string[]): { pluginId: string; hook: AppHook }[]
  /** Order links from every installed app; an app that throws is skipped, never fatal. */
  orderLinks(
    installed: readonly string[],
    ctx: OrderLinkContext,
    orderId: string,
  ): Promise<OrderLink[]>
  /** An installed app's named job, or null when the app or job is unknown or not installed. */
  jobFor(pluginId: string, name: string, installed: readonly string[]): AppJob | null
  /** An installed app's handler for one of its jobs failing for good, or null. */
  jobFailedFor(pluginId: string, name: string, installed: readonly string[]): AppJobFailed | null
  /**
   * Attachments for one order email from every installed app. Unlike links, a
   * failure here throws: the notification job retries rather than sending an
   * email that silently lacks the invoice the store promised.
   */
  emailAttachments(
    installed: readonly string[],
    ctx: AppHookContext,
    input: { orderId: string; template: TemplateId },
  ): Promise<Attachment[]>
}

export const CORE_PLUGIN_ID = 'core'

const KINDS: ProviderKind[] = ['payments', 'shipping', 'notifications', 'storage']

function buildRegistries(plugins: PluginManifest[]): Registries {
  const r: Registries = {
    payments: new PaymentRegistry(),
    shipping: new ShippingRegistry(),
    notifications: new NotificationRegistry(),
    storage: new StorageRegistry(),
  }
  for (const p of plugins) {
    for (const f of p.provides.payments ?? []) r.payments.register(f)
    for (const f of p.provides.shipping ?? []) r.shipping.register(f)
    for (const f of p.provides.notifications ?? []) r.notifications.register(f)
    for (const f of p.provides.storage ?? []) r.storage.register(f)
  }
  return r
}

/** Fail loudly on two plugins claiming the same id, or the same provider id within a kind. */
function checkDuplicates(plugins: PluginManifest[]): ProviderOwners {
  const seenPlugin = new Map<string, PluginManifest>()
  const owners: ProviderOwners = { payments: {}, shipping: {}, notifications: {}, storage: {} }
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
        kind: p.kind,
        category: p.category ?? null,
        company: p.company ?? null,
        tested: p.tested === true,
        hooks: Object.keys(p.hooks ?? {}) as AppEvent[],
        productFields: p.productFields ?? [],
        credits: (p.credits ?? []).map((c) => ({ ...c })),
        access: {
          resources: p.access.resources.map((r) => ({ ...r })),
          summary: p.access.summary ?? null,
          shares: (p.access.shares ?? []).map((s) => ({ ...s })),
        },
        admin: {
          icon: p.admin?.icon ?? null,
          pages: (p.admin?.pages ?? []).map((page) => ({ ...page })),
          orderDetailCard: p.admin?.orderDetailCard === true,
          customerDetailCard: p.admin?.customerDetailCard === true,
          orderActions: orderActionsOf(p, CORE_PLUGIN_ID),
          salesChannel: p.admin?.salesChannel ?? null,
        },
        provides: {
          payments: (p.provides.payments ?? []).map((f) => ({ id: f.id, label: f.label })),
          shipping: (p.provides.shipping ?? []).map((f) => ({ id: f.id, label: f.label })),
          notifications: (p.provides.notifications ?? []).map((f) => ({
            id: f.id,
            label: f.label,
          })),
          storage: (p.provides.storage ?? []).map((f) => ({ id: f.id, label: f.label })),
        },
      })),
    forStore: (installed) => {
      const allowed = new Set([CORE_PLUGIN_ID, ...installed])
      return buildRegistries(plugins.filter((p) => allowed.has(p.id)))
    },
    hooksFor: (event, installed) => {
      const allowed = new Set([CORE_PLUGIN_ID, ...installed])
      return plugins.flatMap((p) => {
        const hook = p.hooks?.[event]
        return hook && allowed.has(p.id) ? [{ pluginId: p.id, hook }] : []
      })
    },
    orderLinks: async (installed, ctx, orderId) => {
      const allowed = new Set([CORE_PLUGIN_ID, ...installed])
      const sources = plugins.filter((p) => p.orderLinks && allowed.has(p.id))
      const results = await Promise.all(
        sources.map((p) =>
          (p.orderLinks?.(ctx, orderId) ?? Promise.resolve([])).catch((): OrderLink[] => []),
        ),
      )
      return results.flat()
    },
    jobFor: (pluginId, name, installed) => {
      if (pluginId !== CORE_PLUGIN_ID && !installed.includes(pluginId)) return null
      return byId.get(pluginId)?.jobs?.[name] ?? null
    },
    jobFailedFor: (pluginId, name, installed) => {
      if (pluginId !== CORE_PLUGIN_ID && !installed.includes(pluginId)) return null
      return byId.get(pluginId)?.jobFailed?.[name] ?? null
    },
    emailAttachments: async (installed, ctx, input) => {
      const allowed = new Set([CORE_PLUGIN_ID, ...installed])
      const out: Attachment[] = []
      for (const p of plugins) {
        if (!p.emailAttachments || !allowed.has(p.id)) continue
        out.push(...(await p.emailAttachments(ctx, input)))
      }
      return out
    },
    providerIds: (pluginId) => {
      const p = byId.get(pluginId)
      return {
        payments: (p?.provides.payments ?? []).map((f) => f.id),
        shipping: (p?.provides.shipping ?? []).map((f) => f.id),
        notifications: (p?.provides.notifications ?? []).map((f) => f.id),
        storage: (p?.provides.storage ?? []).map((f) => f.id),
      }
    },
  }
}
