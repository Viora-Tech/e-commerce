import type { NotificationChannelFactory } from '@commerce/notifications'
import type { PaymentProviderFactory } from '@commerce/payments'
import type { ShippingProviderFactory } from '@commerce/shipping'
import type { StorageProviderFactory } from '@commerce/storage'
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
  return {
    id: input.id,
    name: input.name,
    version: input.version,
    description: input.description,
    provides: {
      payments: input.provides.payments ?? [],
      shipping: input.provides.shipping ?? [],
      notifications: input.provides.notifications ?? [],
      storage: input.provides.storage ?? [],
    },
  }
}

/** Typed identity for commerce.config.ts, so editors autocomplete the shape. */
export function defineConfig(config: CommerceConfig): CommerceConfig {
  return config
}
