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
  | 'search'

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
export type AppEvent = 'order.paid' | 'order.fulfilled' | 'order.delivered' | 'refund.created'

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
  /**
   * Queue an image the app stored as `processing` for the upload-time media
   * pipeline (EXIF/GPS strip, AVIF/WebP variants, ThumbHash), the same job a
   * direct upload gets. Idempotent per media id. Throws when the queue is
   * unreachable, so the caller can record it; `bun run media:reprocess` picks
   * up anything left `processing`. Absent where no queue is wired (tests,
   * scripts).
   */
  processMedia?: ((mediaId: string, opts?: { bulk?: boolean }) => Promise<void>) | undefined
  /**
   * Say what this run did, in a few words ("Issued invoice INV-2041"), for the Installed apps
   * list's "Last activity". Kept only when the hook or job finishes without throwing; the last
   * call wins. Absent where nothing records it (tests, scripts).
   */
  reportActivity?: ((summary: string) => void) | undefined
}

export type AppHook = (ctx: AppHookContext, payload: AppEventPayload) => Promise<void>

/**
 * Background work an app queues for itself (render a PDF, send a batch of
 * emails). Runs in the worker with the same context as a hook, retried on
 * throw, so handlers must be idempotent too.
 */
export type AppJob = (ctx: AppHookContext, data: unknown) => Promise<void>

/**
 * Called once when an app job has failed for good: its last retry threw, or
 * the worker died under it (out of memory, a restart) more often than the
 * queue allows. The place to mark the app's own record failed so a page
 * waiting on it stops waiting. Must not throw for a record that is already
 * finished.
 */
export type AppJobFailed = (ctx: AppHookContext, data: unknown, reason: string) => Promise<void>

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
 * Where an app's order action shows: the order page's "More actions" menu (`detail`), a row's
 * ⋯ menu on the Orders list (`row`), or the Orders list's bulk bar for the selected orders
 * (`bulk`).
 */
export type OrderActionTarget = 'detail' | 'row' | 'bulk'

/**
 * What picking an order action does. Plain data, so the manifest stays serialisable and server
 * code never imports React.
 *
 * - `link`: opens an admin route. `{orderId}` in `path` becomes the order's id; on the bulk bar
 *   `{orderIds}` becomes the selected ids, comma separated.
 * - `procedure`: runs a server action through an existing API procedure. `procedure` is the key
 *   the admin registered the call under (`apps/admin/src/apps/order-action-procedures.ts`,
 *   `<pluginId>/<name>`); an unregistered key is never shown.
 * - `shipment`: opens the Create shipment flow with this courier picked (one order: the order's
 *   Create shipment page; several: the bulk dialog). Added for you for every courier a plugin
 *   provides (see `orderActionsOf`).
 */
export type OrderActionHandler =
  | { type: 'link'; path: string }
  | { type: 'procedure'; procedure: string }
  | { type: 'shipment'; providerId: string }

/**
 * Order states an action needs. The detail page and row menus hide the action on an order
 * that does not match; the bulk bar always offers it and the handler skips what it cannot do.
 * `open`: not cancelled or archived. `unfulfilled`: units still to pack. `paid-or-cod`: the money
 * is in, or the courier collects it. `not-test`: not paid on a gateway's test keys.
 */
export type OrderActionCondition = 'open' | 'unfulfilled' | 'paid-or-cod' | 'not-test'

/** An action an installed app adds to orders, Shopify style: shown under the app's icon and name. */
export type OrderAction = {
  /** Unique within the app, lowercase with dashes, e.g. `add-to-queue`. */
  id: string
  /** The menu text. `hi` is shown to members using the admin in Hindi; English otherwise. */
  label: { en: string; hi?: string | undefined }
  targets: OrderActionTarget[]
  handler: OrderActionHandler
  /** The permission a member needs to see and run it, e.g. `orders.fulfil`. Default `orders.write`. */
  permission?: string | undefined
  requires?: OrderActionCondition[] | undefined
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
  /** Actions on orders: the order page's "More actions", the list's row menu and bulk bar. */
  orderActions?: OrderAction[] | undefined
}

/**
 * A storefront section an installed app contributes to the theme editor's
 * Add panel → Apps tab (Shopify's "app blocks"). `type` must be namespaced
 * `<pluginId>/<Name>` so two apps can never collide; `fields`/`defaultProps`
 * drive the Puck editor form and `render` draws it on the storefront.
 * Kept structurally typed (`unknown`) here so this package stays free of a
 * Puck/React dependency — `@commerce/blocks`'s builder (`buildAppBlocks`)
 * casts these back into real Puck `ComponentConfig`s when it assembles the
 * live config from enabled plugins. See docs/plugins.md.
 */
export type AppBlockDefinition = {
  /** `<pluginId>/<Name>`, e.g. `back-in-stock/NotifyMe`. */
  type: string
  label: string
  description?: string | undefined
  /** Icon name from the admin icon set, shown next to the block in the Add panel. */
  icon?: string | undefined
  /** Puck `Fields` for the block's settings panel. */
  fields: Record<string, unknown>
  defaultProps: Record<string, unknown>
  /** Puck `ComponentConfig['render']`. Client islands are fine; keep it RSC-safe where possible. */
  // biome-ignore lint/suspicious/noExplicitAny: erased Puck render signature; re-typed by the blocks builder.
  render: (props: any) => unknown
  /** Puck `ComponentConfig['resolveData']`, for a block that needs server data before it draws. */
  // biome-ignore lint/suspicious/noExplicitAny: erased Puck resolveData signature; re-typed by the blocks builder.
  resolveData?: ((args: any) => Promise<any>) | undefined
}

/** What a plugin contributes to the storefront beyond providers. */
export type PluginStorefront = {
  blocks?: AppBlockDefinition[] | undefined
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

/**
 * The store data an app can touch, shown on its permission step and in the
 * Installed apps "Can access" column. The admin names each one in the
 * merchant's language; add a value here and a label there together.
 */
export type AppResource =
  | 'orders'
  | 'order-events'
  | 'customers'
  | 'products'
  | 'inventory'
  | 'shipments'
  | 'payments'
  | 'refunds'
  | 'invoices'
  | 'reviews'
  | 'collections'
  | 'discounts'
  | 'gift-cards'
  | 'store-pages'
  | 'content'
  | 'files'
  | 'store-settings'
  | 'visits'

/** `read`: looks only. `write`: creates or changes, never reads back. `read-write`: both. */
export type AppAccessLevel = 'read' | 'write' | 'read-write'

/** One resource an app reads or changes, and why, in a plain line ("Reads new orders to book pickups"). */
export type AppResourceAccess = {
  resource: AppResource
  level: AppAccessLevel
  why: string
}

/** Data the app sends to its outside service, e.g. `{ when: 'Sent per shipment', what: 'Ship-to address, phone…' }`. */
export type AppDataShare = { when: string; what: string }

/**
 * What an app declares it can see and do, so the merchant can judge it before
 * installing and review it after. Derived from what the app's code actually
 * does: never declare more than the code touches, never leave out what it does.
 */
export type AppAccess = {
  resources: AppResourceAccess[]
  /** A few words after the access level in the Installed list, e.g. `makes invoices`. */
  summary?: string | undefined
  /** Data that leaves the platform for the app's outside service. Empty for apps that keep everything here. */
  shares?: AppDataShare[] | undefined
}

/** What the Installed apps list shows for an app besides "installed": derived from the app's own saved settings. */
export type AppSetupState = {
  /** The app has what it needs to work (an account connected, a property chosen). */
  connected: boolean
  /** A recorded failure the merchant must fix, in words; null when none. */
  problem: string | null
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
  /** Per job name: what to do when that job has failed for good (see `AppJobFailed`). */
  jobFailed?: Record<string, AppJobFailed> | undefined
  emailAttachments?: EmailAttachments | undefined
  /** Theme editor app blocks this app contributes (Add panel → Apps tab). */
  storefront?: PluginStorefront | undefined
  /** What the app can see and do in the store; required so no app installs without saying. */
  access: AppAccess
  /**
   * For an app that keeps its connection in its own settings (`store.apps.settings[id]`) rather
   * than a provider: whether it is connected and any recorded problem. Apps with providers are
   * judged by the store's enabled providers instead.
   */
  setupState?: ((settings: unknown) => AppSetupState) | undefined
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
  admin: {
    icon: string | null
    pages: AppPage[]
    orderDetailCard: boolean
    /** Declared actions plus a Create shipment per courier the plugin provides. */
    orderActions: OrderAction[]
  }
  credits: AppCredit[]
  access: {
    resources: AppResourceAccess[]
    summary: string | null
    shares: AppDataShare[]
  }
}
