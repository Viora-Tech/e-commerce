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

/** What an import problem is about: a record, one of its images, or a file from Files. */
export const ISSUE_KINDS = ['record', 'media', 'file'] as const
export type IssueKind = (typeof ISSUE_KINDS)[number]

/** `cancelled`: someone pressed Stop import; what it had imported stays. */
export const RUN_STATUSES = ['queued', 'running', 'completed', 'failed', 'cancelled'] as const
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
  /** A file nothing imported uses; "Also import unused files" copies it. */
  'unused_file',
  'external_video',
  'model_3d',
  /** Shopify was still processing the file, or it failed there. */
  'file_not_ready',
  /** The store's file storage could not be written, so no image or file was copied. */
  'storage_unwritable',
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
  /** A redirect for that path was set here by hand; the merchant's own one was kept. */
  'redirect_manual',
  /** A redirect from the home page or an empty path. */
  'redirect_invalid',
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
  /** Products only: how many images the records carry (a preview counts them for the status page). */
  images?: number | undefined
  /**
   * An import only: images and files copied so far, and those given up on (each is an
   * issue). They move while a batch's copies run, before its records are counted.
   */
  copied?: number | undefined
  notCopied?: number | undefined
  /** Files only: what the Files step copies (or would copy) and weighs once optimized. */
  estimate?: FilesEstimate | undefined
}

/** Files counted by kind with their estimated stored size in bytes (after optimizing). */
export type FilesBucket = { count: number; bytes: number }
export type FilesEstimate = {
  images: FilesBucket
  videos: FilesBucket
  other: FilesBucket
  /** Files nothing uses; copied only when `includeUnused`. */
  unused: FilesBucket
  includeUnused: boolean
  /** What will be stored: images, videos and other files that are copied. */
  totalBytes: number
}

/** One sample row the dry run shows: what it is and what would happen to it. */
export type PreviewSample = {
  resource: ImportResource
  key: string
  title: string
  action: 'create' | 'update' | 'skip'
  detail?: string | undefined
  /** A picture to show next to the title (the first product image), when there is one. */
  image?: string | undefined
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

/** The scopes each resource cannot be read without (`read_all_orders` is only a warning). */
export const RESOURCE_SCOPES: Record<ImportResource, ScopeHandle[]> = {
  products: ['read_products', 'read_inventory'],
  collections: ['read_products'],
  customers: ['read_customers'],
  orders: ['read_orders'],
  pages: ['read_content'],
  articles: ['read_content'],
  menus: ['read_online_store_navigation'],
  redirects: ['read_online_store_navigation'],
  files: ['read_files'],
  metaobjects: ['read_metaobject_definitions', 'read_metaobjects'],
  metafields: ['read_products'],
  discounts: ['read_discounts'],
  gift_cards: ['read_gift_cards'],
}

/** "Before you import" checks, shown before Preview import and Import now. */
export const PREFLIGHT_IDS = [
  /** Images and files need cloud storage; the local folder fallback is not writable in production. */
  'storage',
  /** The saved Shopify connection could not be checked. */
  'connection',
  /** A chosen resource's scope is missing: that resource cannot be imported. */
  'scope',
  /** Orders older than 60 days need read_all_orders. */
  'all_orders',
  /** Orders, collections, discounts or extra fields point at products that are not here yet. */
  'needs_products',
  /** Gift cards belong to customers that are not here yet. */
  'needs_customers',
] as const
export type PreflightId = (typeof PREFLIGHT_IDS)[number]

/** `block` stops only `resource` (or everything when it has none); `warn` still lets it run. */
export type PreflightCheck = {
  id: PreflightId
  status: 'ok' | 'warn' | 'block'
  resource?: ImportResource | undefined
  /** The missing scopes, or the error the connection check gave. */
  detail?: string | undefined
  title: string
  help: string
  /** Admin path that fixes it, when there is one. */
  fixHref: string | null
}

/** Why problems happened, for grouping them on the run page. */
export const ISSUE_CAUSES = [
  /** File storage refused the copy (not connected, or not writable). */
  'storage',
  /** The Shopify app lacks a scope. */
  'scope',
  /** The order number already belongs to an order placed here. */
  'order_number',
  /** An image could not be downloaded or copied. */
  'image',
  /** A file from Files could not be copied. */
  'file',
  /** A record could not be saved. */
  'record',
  /** Something that stays in Shopify or arrives changed (the note says what). */
  'note',
] as const
export type IssueCause = (typeof ISSUE_CAUSES)[number]

export type IssueGroup = {
  cause: IssueCause
  /** The types it happened on (storage and scope problems span several). */
  resources: string[]
  count: number
  /**
   * Records "Retry the ones that were missed" would bring over again: distinct record
   * keys, the same unit as the run's "N records to retry" (one product can have several
   * failed images).
   */
  retryable: number
  /** The problems among `count` that a retry covers (e.g. 77 images across 23 products). */
  retryableProblems: number
  /** One of the messages, as an example. */
  sample: string
  fixHref: string | null
}

/** One row of "What is left to import". */
export type ResourceStatus = {
  resource: ImportResource
  /**
   * How many Shopify has: its own count, else the latest preview's (or its kept copy),
   * else the latest full import's; null when nothing ever counted them.
   */
  inShopify: number | null
  countedFrom: 'shopify' | 'preview' | 'import' | null
  countedAt: string | null
  /** Records here from Shopify (the import mapping). */
  imported: number
  /** Not imported yet, or with an open problem from their last import. */
  missing: number
  /**
   * `not_copied`: files that are in Shopify but not in this store's storage.
   * `unknown`: Shopify's number is not known, so it is never called done.
   */
  state: 'done' | 'missing' | 'not_copied' | 'never' | 'unknown'
  lastImportAt: string | null
}

export type ImportStatus = {
  resources: ResourceStatus[]
  /**
   * Product images: how many Shopify's products carry (the latest preview's or full
   * import's count; for an older import without one, what is here plus what it could
   * not copy), how many are here (linked to imported products), and how many are not.
   */
  images: {
    expected: number | null
    here: number
    missing: number
    countedFrom: 'preview' | 'import' | null
    countedAt: string | null
    state: 'done' | 'not_copied' | 'unknown'
  }
  /** What "Import remaining" covers. */
  remaining: ImportResource[]
  lastImportAt: string | null
  /** A preview under 24 hours old: the next import reads its copy instead of Shopify. */
  freshPreview: { runId: string; takenAt: string } | null
}

/** Which mode a saved connection authenticates with. */
export const AUTH_MODES = ['legacy', 'client_credentials'] as const
export type AuthMode = (typeof AUTH_MODES)[number]

/** What `testConnection` reports: shop name plus which scopes the token has and lacks. */
export type ScopeCheck = {
  shopName: string
  granted: ScopeHandle[]
  missing: ScopeHandle[]
}
