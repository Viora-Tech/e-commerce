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
] as const
export type ImportResource = (typeof IMPORT_RESOURCES)[number]

/** Shopify's three CSV exports. */
export const CSV_RESOURCES = ['products', 'customers', 'orders'] as const
export type CsvResource = (typeof CSV_RESOURCES)[number]

export const RUN_STATUSES = ['queued', 'running', 'completed', 'failed'] as const
export type RunStatus = (typeof RUN_STATUSES)[number]

/** Counters per resource, updated while the job runs. */
export type ResourceProgress = {
  total: number
  processed: number
  created: number
  updated: number
  skipped: number
  failed: number
}

/** One sample row the dry run shows: what it is and what would happen to it. */
export type PreviewSample = {
  resource: ImportResource
  key: string
  title: string
  action: 'create' | 'update' | 'skip'
  detail?: string | undefined
}

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
}
