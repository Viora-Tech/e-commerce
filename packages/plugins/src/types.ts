import type { StoreTx } from '@commerce/db'
import type { Attachment, NotificationChannelFactory, TemplateId } from '@commerce/notifications'
import type { PaymentProviderFactory } from '@commerce/payments'
import type { ShippingProviderFactory } from '@commerce/shipping'
import type { StorageProvider, StorageProviderFactory } from '@commerce/storage'

/** The kinds of provider a plugin can contribute. Each maps to one registry. */
export type ProviderKind = 'payments' | 'shipping' | 'notifications' | 'storage'

/**
 * Which Apps section a plugin lists under. `builtin`: a feature we designed
 * that runs inside the platform with no outside account (back-in-stock, GST
 * invoices, Shopify import, the core plugin). `connection`: links the store
 * to another company's service and needs that company's account (a storage
 * bucket, a payment gateway, a courier, a message channel). Required on every
 * manifest so a plugin cannot land in the wrong section by omission.
 */
export type PluginKind = 'builtin' | 'connection'

/**
 * Standard categories for a `connection` plugin's `category`, used for the
 * Connections filter chips. `builtin` plugins keep freeform categories
 * (`invoicing`, `migration`, `marketing`, ...) since they are not filtered
 * the same way.
 */
export type ConnectionCategory =
  | 'storage'
  | 'payments'
  | 'shipping'
  | 'messages'
  | 'analytics'
  | 'marketing'

/**
 * What a plugin contributes. A plugin is a package that ships one or more
 * provider factories; the platform never imports an adapter directly, it
 * imports plugins listed in commerce.config.ts.
 */
export type PluginProvides = {
  payments?: PaymentProviderFactory<unknown>[] | undefined
  shipping?: ShippingProviderFactory<unknown>[] | undefined
  notifications?: NotificationChannelFactory<unknown>[] | undefined
  storage?: StorageProviderFactory<unknown>[] | undefined
}

/**
 * Order lifecycle events an installed app can react to. Fired by the worker,
 * at least once per (order, event) or (refund, event); hooks must be idempotent.
 */
export type AppEvent = 'order.paid' | 'order.fulfilled' | 'refund.created'

export type AppEventPayload = {
  storeId: string
  orderId: string
  /** Set for `refund.created`. */
  refundId?: string | undefined
}

/** What a hook gets to work with. Everything is scoped to the one store. */
export type AppHookContext = {
  storeId: string
  /** Runs `fn` in a transaction with row-level security set to this store. */
  inStore<T>(fn: (tx: StoreTx) => Promise<T>): Promise<T>
  /** The store's active storage provider, for files the app generates. */
  storage(): Promise<StorageProvider>
  /** Used to sign links (e.g. a private download) the same way the platform does. */
  settingsSecret: string
  storefrontUrl: string | null
  log(message: string): void
  /**
   * Send an order email through the store's channels, e.g. a document copy
   * with its PDF. Resolves with what went out; never throws on a channel error.
   */
  notify(input: {
    orderId: string
    template: TemplateId
    attachments?: Attachment[] | undefined
    documentLabel?: string | undefined
    links?: OrderLink[] | undefined
  }): Promise<{ sent: number; errors: string[] }>
}

export type AppHook = (ctx: AppHookContext, payload: AppEventPayload) => Promise<void>

/**
 * Background work an app queues for itself (render a PDF, send a batch of
 * emails). Runs in the worker with the same context as a hook, retried on
 * throw, so handlers must be idempotent too.
 */
export type AppJob = (ctx: AppHookContext, data: unknown) => Promise<void>

/** Files an app attaches to one order email; called while the email is being sent. */
export type EmailAttachments = (
  ctx: AppHookContext,
  input: { orderId: string; template: TemplateId },
) => Promise<Attachment[]>

/** A link an app adds to the shopper's order page and order emails. */
export type OrderLink = { label: string; url: string }

export type OrderLinkContext = Pick<
  AppHookContext,
  'storeId' | 'inStore' | 'settingsSecret' | 'storefrontUrl'
> & {
  /** Where the links show: apps can offer them in emails, on the order page, or both. */
  surface: 'email' | 'storefront'
}

/**
 * Variant fields an app asks the product form to show. Keys are limited to
 * columns the platform owns, so an app surfaces a field without a schema
 * change of its own.
 */
export type ProductField = {
  key: 'hsCode' | 'gstRatePercent'
  label: string
  help?: string | undefined
}

/**
 * One page an installed app adds under `/apps/<pluginId>/<path>`, inside the
 * normal admin shell with the app's header and tabs.
 */
export type AppPage = {
  /** Relative to the app root: `''` is `/apps/<pluginId>`, `'settings'` is `/apps/<pluginId>/settings`. */
  path: string
  title: string
  /** Tab label in the app's sub-navigation; omit to keep the page out of the tabs (detail pages). */
  navLabel?: string | undefined
  /** Icon name from the admin icon set, e.g. `FileText`. */
  icon?: string | undefined
}

/**
 * What an app adds to the admin, Shopify style: its own pages under
 * `/apps/<pluginId>/...` and an entry in the sidebar's Apps group. Apps never
 * mount inside Settings. The components are registered in the admin app's
 * registry (client code), keyed by plugin id; the manifest only declares them
 * so server code never imports React.
 */
export type AppAdmin = {
  /** Sidebar and app-header icon name. */
  icon?: string | undefined
  /** The first page is the app's root and the sidebar link. */
  pages?: AppPage[] | undefined
  /** A card on the order detail page. */
  orderDetailCard?: boolean | undefined
}

/**
 * Open-source work an app is built on, shown on its Apps card so merchants see
 * where it comes from. Every app that adapts outside code must list it here
 * (and keep the full licence per THIRD_PARTY_NOTICES.md).
 */
export type AppCredit = {
  /** Project name, e.g. `invoicely`. */
  name: string
  /** Project home or repository. */
  url: string
  /** SPDX id, e.g. `MIT`. */
  license: string
  /** What we took, e.g. `PDF invoice templates`. */
  note?: string | undefined
}

export type PluginManifest = {
  /** Stable lowercase id, e.g. `razorpay`, `delhivery`, `fedex`. Unique per deployment. */
  id: string
  name: string
  version: string
  description?: string | undefined
  /** Built by us and needs no outside account, or a connection to another company's service. */
  kind: PluginKind
  /** Shown as a badge on the Apps page. Connections use `ConnectionCategory`; built-ins are freeform. */
  category?: string | undefined
  /** The outside company behind a `connection` plugin, e.g. `Cloudflare`, `Razorpay`, `Meta`. Shown as "by <company>". */
  company?: string | undefined
  provides: PluginProvides
  hooks?: Partial<Record<AppEvent, AppHook>> | undefined
  /** Links added to the shopper's order page and order emails. Must be cheap: runs per render. */
  orderLinks?: ((ctx: OrderLinkContext, orderId: string) => Promise<OrderLink[]>) | undefined
  productFields?: ProductField[] | undefined
  admin?: AppAdmin | undefined
  /** Open-source projects this app is built on. */
  credits?: AppCredit[] | undefined
  /** Named background jobs, queued with `enqueueAppJob`. */
  jobs?: Record<string, AppJob> | undefined
  emailAttachments?: EmailAttachments | undefined
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
  kind: PluginKind
  category: string | null
  company: string | null
  provides: Record<ProviderKind, { id: string; label: string }[]>
  /** Lifecycle events the app subscribes to. */
  hooks: AppEvent[]
  productFields: ProductField[]
  admin: { icon: string | null; pages: AppPage[]; orderDetailCard: boolean }
  credits: AppCredit[]
}
