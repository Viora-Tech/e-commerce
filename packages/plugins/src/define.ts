import type { NotificationChannelFactory } from '@commerce/notifications'
import type { PaymentProviderFactory } from '@commerce/payments'
import type { ShippingProviderFactory } from '@commerce/shipping'
import type { StorageProviderFactory } from '@commerce/storage'
import { validateOrderActions } from './order-actions'
import type { CommerceConfig, PluginManifest } from './types'

const ID_PATTERN = /^[a-z][a-z0-9-]*$/

/** Accepts factories of any config type; the registries erase the generic the same way. */
type DefinePluginInput = Omit<PluginManifest, 'provides'> & {
  provides: {
    // biome-ignore lint/suspicious/noExplicitAny: factories are generic over their own config; erased at registration.
    payments?: PaymentProviderFactory<any>[] | undefined
    // biome-ignore lint/suspicious/noExplicitAny: same as above.
    shipping?: ShippingProviderFactory<any>[] | undefined
    // biome-ignore lint/suspicious/noExplicitAny: same as above.
    notifications?: NotificationChannelFactory<any>[] | undefined
    // biome-ignore lint/suspicious/noExplicitAny: same as above.
    storage?: StorageProviderFactory<any>[] | undefined
  }
}

/**
 * Declare a plugin. Validates the shape eagerly so a typo in a package's
 * manifest fails at import time, not when a merchant first opens Settings.
 */
export function definePlugin(input: DefinePluginInput): PluginManifest {
  if (!ID_PATTERN.test(input.id)) {
    throw new Error(`plugin id "${input.id}" must be lowercase letters, digits and dashes`)
  }
  if (!input.name.trim()) throw new Error(`plugin "${input.id}" needs a name`)
  if (!input.version.trim()) throw new Error(`plugin "${input.id}" needs a version`)
  if (input.kind !== 'builtin' && input.kind !== 'connection') {
    throw new Error(`plugin "${input.id}" needs kind: 'builtin' or 'connection'`)
  }
  const seenResources = new Set<string>()
  for (const r of input.access.resources) {
    if (seenResources.has(r.resource)) {
      throw new Error(`plugin "${input.id}" declares access to "${r.resource}" twice`)
    }
    seenResources.add(r.resource)
  }
  const seenBlockTypes = new Set<string>()
  for (const block of input.storefront?.blocks ?? []) {
    if (!block.type.startsWith(`${input.id}/`)) {
      throw new Error(
        `app block "${block.type}" on plugin "${input.id}" must be namespaced "${input.id}/<Name>"`,
      )
    }
    if (seenBlockTypes.has(block.type)) {
      throw new Error(`plugin "${input.id}" declares app block "${block.type}" twice`)
    }
    seenBlockTypes.add(block.type)
  }
  if (input.listing) {
    if (!input.listing.tagline.trim())
      throw new Error(`plugin "${input.id}" listing needs a tagline`)
    if (input.listing.highlights.length === 0) {
      throw new Error(`plugin "${input.id}" listing needs at least one highlight`)
    }
    if (input.listing.guide && !input.listing.guide.startsWith('/')) {
      throw new Error(`plugin "${input.id}" listing guide must be a docs path starting with "/"`)
    }
  }
  validateOrderActions(input)
  validateAutomations(input)
  return {
    id: input.id,
    name: input.name,
    version: input.version,
    description: input.description,
    kind: input.kind,
    category: input.category,
    company: input.company,
    hooks: input.hooks,
    orderLinks: input.orderLinks,
    productFields: input.productFields,
    admin: input.admin,
    credits: input.credits,
    jobs: input.jobs,
    jobFailed: input.jobFailed,
    emailAttachments: input.emailAttachments,
    storefront: input.storefront,
    access: input.access,
    listing: input.listing,
    setupState: input.setupState,
    lastUsed: input.lastUsed,
    appBar: input.appBar,
    automations: input.automations,
    provides: {
      payments: input.provides.payments ?? [],
      shipping: input.provides.shipping ?? [],
      notifications: input.provides.notifications ?? [],
      storage: input.provides.storage ?? [],
    },
  }
}

const PIECE_NAME = /^[a-z][a-z0-9_.-]*$/

/** Automations pieces must be namespaced `<pluginId>/<name>` and unique within the app. */
function validateAutomations(input: DefinePluginInput) {
  const seen = new Set<string>()
  const pieces = [
    ...(input.automations?.triggers ?? []).map((t) => ['trigger', t.id] as const),
    ...(input.automations?.actions ?? []).map((a) => ['action', a.id] as const),
  ]
  for (const [kind, id] of pieces) {
    const [ns, name, ...rest] = id.split('/')
    if (ns !== input.id || !name || rest.length > 0 || !PIECE_NAME.test(name)) {
      throw new Error(
        `automation ${kind} "${id}" on plugin "${input.id}" must be namespaced "${input.id}/<name>"`,
      )
    }
    if (seen.has(`${kind}:${id}`)) {
      throw new Error(`plugin "${input.id}" declares automation ${kind} "${id}" twice`)
    }
    seen.add(`${kind}:${id}`)
  }
}

/** Typed identity for commerce.config.ts, so editors autocomplete the shape. */
export function defineConfig(config: CommerceConfig): CommerceConfig {
  return config
}
