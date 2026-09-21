import type { NotificationChannelFactory } from '@commerce/notifications'
import type { PaymentProviderFactory } from '@commerce/payments'
import type { ShippingProviderFactory } from '@commerce/shipping'

/** The kinds of provider a plugin can contribute. Each maps to one registry. */
export type ProviderKind = 'payments' | 'shipping' | 'notifications'

/**
 * What a plugin contributes. A plugin is a package that ships one or more
 * provider factories; the platform never imports an adapter directly, it
 * imports plugins listed in commerce.config.ts.
 */
export type PluginProvides = {
  payments?: PaymentProviderFactory<unknown>[] | undefined
  shipping?: ShippingProviderFactory<unknown>[] | undefined
  notifications?: NotificationChannelFactory<unknown>[] | undefined
}

export type PluginManifest = {
  /** Stable lowercase id, e.g. `razorpay`, `delhivery`, `fedex`. Unique per deployment. */
  id: string
  name: string
  version: string
  description?: string | undefined
  provides: PluginProvides
}

/** commerce.config.ts shape. The core plugin is always loaded and never listed here. */
export type CommerceConfig = {
  plugins: PluginManifest[]
}

/** Serialisable view of a manifest for the admin: no factories, only labels. */
export type PluginSummary = {
  id: string
  name: string
  version: string
  description: string | null
  /** True for the core plugin, which every store has and nobody can uninstall. */
  builtIn: boolean
  provides: Record<ProviderKind, { id: string; label: string }[]>
}
