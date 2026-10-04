/**
 * Constants and types the admin needs in the browser. Pure: no database, no
 * Node APIs. Server code imports these through `./schema` as well.
 */

export const SHOPIFY_IMPORT_ID = 'shopify-import'

/** What one import can bring over, in the order a run writes them. */
export const IMPORT_RESOURCES = [
  'products',
  'collections',
  'customers',
  'orders',
  'pages',
  'articles',
  'menus',
  'redirects',
  'files',
  'metaobjects',
  'metafields',
  'discounts',
  'gift_cards',
] as const
export type ImportResource = (typeof IMPORT_RESOURCES)[number]

/** Shopify's three CSV exports. */
export const CSV_RESOURCES = ['products', 'customers', 'orders'] as const
export type CsvResource = (typeof CSV_RESOURCES)[number]

export const RUN_STATUSES = ['queued', 'running', 'completed', 'failed'] as const
export type RunStatus = (typeof RUN_STATUSES)[number]

/**
 * Why something stays in Shopify (or arrives changed). Stored as a code so the
 * admin can say it in the merchant's language; `detail` carries the Shopify
 * type or owner the reason is about.
 */
export const LEFT_BEHIND_REASONS = [
  /** Extra fields on something we have no extra fields for yet (variants, customers…). */
  'metafield_owner',
  /** A Shopify field type with no match here (money, rating, JSON…). */
  'field_type',
  /** A link to an entry whose content type is unknown here. */
  'reference_target',
  /** A value that did not fit its field (a broken link, a product that was not imported). */
  'field_value',
  /** Date and time fields keep the date only. */
  'time_dropped',
  /** Link fields keep the address, not the link text. */
  'link_label',
  /** Files the media library cannot hold yet (PDFs and other documents). */
  'file_type',
  'video_too_large',
  'external_video',
  'model_3d',
  /** Shopify was still processing the file, or it failed there. */
  'file_not_ready',
  'buy_x_get_y',
  'app_discount',
  'customer_specific',
  'minimum_quantity',
  'variant_specific',
  'per_item_amount',
  'shipping_rules',
  'code_characters',
  'items_not_imported',
  /** Shopify never shares full gift card codes; the card got a new code. */
  'gift_card_code',
  'gift_card_no_customer',
  'gift_card_empty',
  'gift_card_over_limit',
  'gift_card_currency',
  'gift_card_used_here',
] as const
export type LeftBehindReason = (typeof LEFT_BEHIND_REASONS)[number]

/** One line of "what stays in Shopify": a reason, how many, and what it is about. */
export type LeftBehind = { reason: LeftBehindReason; detail?: string | undefined; count: number }

/** Counters per resource, updated while the job runs. */
export type ResourceProgress = {
  total: number
  processed: number
  created: number
  updated: number
  skipped: number
  failed: number
  /** What was not brought over (or arrived changed), summed by reason. */
  left?: LeftBehind[] | undefined
}

/** One sample row the dry run shows: what it is and what would happen to it. */
export type PreviewSample = {
  resource: ImportResource
  key: string
  title: string
  action: 'create' | 'update' | 'skip'
  detail?: string | undefined
}

/**
 * What a preview keeps so the import that follows reads it instead of asking
 * Shopify again: the resources Shopify can say "changed since" for. The rest
 * (menus, redirects, content types, extra fields, discounts, gift cards) are
 * read again in full, because Shopify cannot filter them by update time or
 * their counts (balances, uses) change without one.
 */
export const SNAPSHOT_RESOURCES = [
  'products',
  'collections',
  'customers',
  'orders',
  'pages',
  'articles',
  'files',
] as const
export type SnapshotResource = (typeof SNAPSHOT_RESOURCES)[number]

/** A preview's saved copy: where each resource's items are stored and how many. */
export type ImportSnapshot = {
  /** When the preview started reading; the import asks Shopify for changes since then. */
  takenAt: string
  streams: Partial<Record<SnapshotResource, { key: string; count: number }>>
}

/** What a real import took from the preview: shown as "Using preview from … + N changes since". */
export type SnapshotUse = {
  takenAt: string
  /** Records Shopify said changed (or were added) since the preview. */
  changes: number
  reused: SnapshotResource[]
}

/** A preview is reused for 24 hours; after that the import reads Shopify again. */
export const SNAPSHOT_FRESH_MS = 24 * 60 * 60 * 1000
/** Unused snapshots are deleted after 7 days. */
export const SNAPSHOT_KEEP_MS = 7 * 24 * 60 * 60 * 1000
/** The app job that deletes them; the worker's hourly sweep queues it per store. */
export const SNAPSHOT_CLEANUP_JOB = 'cleanup-snapshots'

/** 15 MB of CSV is roughly 50,000 product rows; larger stores use the API import. */
export const MAX_CSV_BYTES = 15 * 1024 * 1024

/** Admin API scopes the custom app needs, one per resource. */
export const REQUIRED_SCOPES: Record<ImportResource, string> = {
  products: 'read_products, read_inventory',
  collections: 'read_products',
  customers: 'read_customers',
  orders: 'read_orders (read_all_orders for orders older than 60 days)',
  pages: 'read_content',
  articles: 'read_content',
  menus: 'read_online_store_navigation',
  redirects: 'read_online_store_navigation',
  files: 'read_files',
  metaobjects: 'read_metaobject_definitions, read_metaobjects',
  metafields: 'read_products (read_metaobjects for linked entries)',
  discounts: 'read_discounts',
  gift_cards: 'read_gift_cards',
}

/** The same scopes as handles, for checking what a token actually has. */
export const ALL_SCOPE_HANDLES = [
  'read_products',
  'read_inventory',
  'read_customers',
  'read_orders',
  'read_all_orders',
  'read_content',
  'read_online_store_navigation',
  'read_files',
  'read_metaobject_definitions',
  'read_metaobjects',
  'read_discounts',
  'read_gift_cards',
] as const
export type ScopeHandle = (typeof ALL_SCOPE_HANDLES)[number]

/** Which mode a saved connection authenticates with. */
export const AUTH_MODES = ['legacy', 'client_credentials'] as const
export type AuthMode = (typeof AUTH_MODES)[number]

/** What `testConnection` reports: shop name plus which scopes the token has and lacks. */
export type ScopeCheck = {
  shopName: string
  granted: ScopeHandle[]
  missing: ScopeHandle[]
}
