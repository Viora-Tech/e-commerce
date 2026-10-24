/**
 * SOURCE OF TRUTH: which writes invalidate the storefront's caches.
 * WHAT: the Postgres channel the storefront LISTENs on, the tables whose rows a storefront page
 *   renders (each carries the `storefront_cache_notify` trigger, migration 0115), and every other
 *   table with a `store_id`, with the reason it never changes a page.
 * WHY: the storefront caches rendered sections and store data per store (apps/storefront
 *   `lib/cache-stamp.ts`). A trigger catches every write path (admin, worker, importers, scripts)
 *   where hooks in the services would miss some. `test/storefront-cache.test.ts` fails when a new
 *   table with a `store_id` is in neither list, so a new table is always classified on purpose.
 */

import postgres from 'postgres'

/** The NOTIFY channel. Payload: the store id, or `<store id>:soft` for a write that may wait. */
export const STOREFRONT_CACHE_CHANNEL = 'storefront_cache'

/** Suffix on a soft notification (media processing): applied at most once a minute per store. */
const STOREFRONT_CACHE_SOFT = ':soft'

/**
 * Tables a storefront page reads. A write to any of them drops that store's cached pages at once
 * (`media` softly: the worker updates rows as images finish processing). The `store` row itself
 * has its own trigger, which ignores the order counter and the admin's accent colour.
 */
export const STOREFRONT_CACHE_TABLES = [
  'article',
  'back_in_stock_settings',
  'blog',
  'business',
  'collection',
  'collection_product',
  'discount',
  'gst_registration',
  'inventory_level',
  'location',
  'media',
  'metafield',
  'metafield_definition',
  'metaobject',
  'metaobject_definition',
  'navigation_menu',
  'page',
  'product',
  'product_media',
  'product_option',
  'product_option_value',
  'review',
  'review_media',
  'shipping_rate',
  'shipping_zone',
  'store_domain',
  'theme',
  'theme_file',
  'theme_import',
  'theme_template',
  'theme_version',
  'url_redirect',
  'variant',
  'variant_option_value',
] as const

/** Of the tables above, the ones whose writes are soft (see `STOREFRONT_CACHE_SOFT`). */
export const STOREFRONT_CACHE_SOFT_TABLES = ['media'] as const

const SHOPPER = 'shopper or order data: personal pages are never cached'
const ADMIN = 'admin-only data no storefront page shows'
const LOG = 'history or usage log; the current value lives in another table'

/** Every other table with a `store_id`: writes here never change a cached page. */
export const STOREFRONT_CACHE_EXEMPT: Record<string, string> = {
  address: SHOPPER,
  ai_action: ADMIN,
  ai_credit_topup: ADMIN,
  ai_job: ADMIN,
  ai_job_item: ADMIN,
  ai_settings: ADMIN,
  ai_usage: LOG,
  api_activity: LOG,
  api_auth_code: ADMIN,
  api_grant: ADMIN,
  app_installation: ADMIN,
  app_purchase: ADMIN,
  autopay_mandate: ADMIN,
  back_in_stock_signup: SHOPPER,
  back_in_stock_usage: LOG,
  cart: SHOPPER,
  cart_line: SHOPPER,
  channel_connection: ADMIN,
  channel_listing: LOG,
  contact_message: SHOPPER,
  cookie_consent: SHOPPER,
  courier_wallet_balance: ADMIN,
  customer: SHOPPER,
  customer_address: SHOPPER,
  customer_identity: SHOPPER,
  customer_login_code: SHOPPER,
  customer_login_ticket: SHOPPER,
  customer_otp: SHOPPER,
  customer_passkey: SHOPPER,
  customer_segment: ADMIN,
  customer_session: SHOPPER,
  data_request: SHOPPER,
  discount_usage: LOG,
  experiment_event: LOG,
  fulfillment_order: SHOPPER,
  fulfillment_order_line: SHOPPER,
  gift_card: SHOPPER,
  gift_card_transaction: LOG,
  inbound_shipment: ADMIN,
  inbox_block: ADMIN,
  inbox_conversation: 'chat threads load in the widget, never in a cached page',
  inbox_message: 'chat messages load in the widget, never in a cached page',
  inbox_quick_reply: ADMIN,
  inventory_adjustment: LOG,
  invoice: SHOPPER,
  invoice_batch: ADMIN,
  invoice_line: SHOPPER,
  invoice_period: ADMIN,
  invoice_sequence: ADMIN,
  invoice_settings: ADMIN,
  marketing_automation: ADMIN,
  marketing_automation_run: LOG,
  marketing_campaign: ADMIN,
  marketing_consent_event: LOG,
  marketing_email_template: ADMIN,
  marketing_message: SHOPPER,
  marketing_session: SHOPPER,
  member_push_subscription: ADMIN,
  newsletter_signup: SHOPPER,
  notification: SHOPPER,
  order: SHOPPER,
  order_line: SHOPPER,
  order_note: SHOPPER,
  outbox_event: LOG,
  payment: SHOPPER,
  payment_event: LOG,
  // Classified with the Pixels PR (they were missing): Affiliates, Automations, Profit, platform apps.
  affiliate: "an affiliate's own pages are personal and never cached",
  affiliate_commission: ADMIN,
  affiliate_payout: ADMIN,
  automation_run: LOG,
  automation_run_record: LOG,
  automation_secret: ADMIN,
  automation_step_run: LOG,
  automation_usage: LOG,
  automation_version: ADMIN,
  automation_workflow: ADMIN,
  monthly_expense: ADMIN,
  platform_account: ADMIN,
  // Pixels app: the storefront starts reading pixel ids in Pixels PR 4, which moves this one
  // into STOREFRONT_CACHE_TABLES with its trigger.
  pixel_connection: ADMIN,
  pixel_event_day: LOG,
  pixel_event_log: LOG,
  plan_payment: ADMIN,
  privacy_audit_event: LOG,
  purchase_charge: ADMIN,
  purchase_charge_split: ADMIN,
  purchase_document: ADMIN,
  purchase_order: ADMIN,
  purchase_order_line: ADMIN,
  purchase_order_receipt: ADMIN,
  purchase_order_receipt_line: ADMIN,
  refund: SHOPPER,
  return_request: SHOPPER,
  return_request_line: SHOPPER,
  review_request: SHOPPER,
  role: ADMIN,
  role_permission: ADMIN,
  saved_report: ADMIN,
  search_console_row: ADMIN,
  sender_email: ADMIN,
  shipment: SHOPPER,
  shipment_manifest: ADMIN,
  shipment_pickup: ADMIN,
  shipment_webhook_event: LOG,
  shopify_import_connection: ADMIN,
  shopify_import_issue: ADMIN,
  shopify_import_mapping: ADMIN,
  shopify_import_run: ADMIN,
  short_link: 'short links redirect before any page renders',
  short_link_click_day: LOG,
  store_export: ADMIN,
  store_plan: ADMIN,
  store_invitation: ADMIN,
  store_member: ADMIN,
  supplier: ADMIN,
  theme_file_version: LOG,
  transfer: ADMIN,
  transfer_line: ADMIN,
}

/** Parses a notification payload; null for anything that is not one of ours. */
export function parseStorefrontCachePayload(
  payload: string,
): { storeId: string; soft: boolean } | null {
  const soft = payload.endsWith(STOREFRONT_CACHE_SOFT)
  const storeId = soft ? payload.slice(0, -STOREFRONT_CACHE_SOFT.length) : payload
  return UUID.test(storeId) ? { storeId, soft } : null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type StorefrontCacheHandlers = {
  /** A write to a rendered table of this store committed. */
  onChange: (storeId: string, soft: boolean) => void
  /** Listening (again). Anything before this may have been missed. */
  onLive: () => void
  /** The connection dropped; notifications are missed until `onLive`. */
  onLost: () => void
}

/**
 * Listens on `STOREFRONT_CACHE_CHANNEL` over one dedicated connection, reconnecting with backoff
 * (1 s doubling to 30 s) for as long as the process runs. postgres.js's own `listen` re-listens
 * once after a drop and gives up silently if that fails, which would leave a cache trusting a
 * dead listener; this one reports every loss and keeps trying.
 */
export function listenStorefrontCache(
  url: string,
  handlers: StorefrontCacheHandlers,
): { close: () => Promise<void> } {
  let retryMs = 1_000
  let timer: ReturnType<typeof setTimeout> | null = null
  let closed = false
  const options = {
    max: 1,
    idle_timeout: 0,
    max_lifetime: null,
    connection: { application_name: 'storefront-cache' },
    onclose: () => {
      handlers.onLost()
      retry()
    },
    // Implemented by postgres.js (its own `listen` uses it) but missing from its types.
    onnotify: (channel: string, payload: string) => {
      if (channel !== STOREFRONT_CACHE_CHANNEL) return
      const parsed = parseStorefrontCachePayload(payload)
      if (parsed) handlers.onChange(parsed.storeId, parsed.soft)
    },
  }
  const sql = postgres(url, options as postgres.Options<Record<string, never>>)
  const listen = async () => {
    timer = null
    if (closed) return
    try {
      await sql.unsafe(`listen ${STOREFRONT_CACHE_CHANNEL}`)
      retryMs = 1_000
      handlers.onLive()
    } catch {
      handlers.onLost()
      retry()
    }
  }
  const retry = () => {
    if (closed || timer) return
    timer = setTimeout(listen, retryMs)
    timer.unref?.()
    retryMs = Math.min(retryMs * 2, 30_000)
  }
  void listen()
  return {
    close: async () => {
      closed = true
      if (timer) clearTimeout(timer)
      await sql.end({ timeout: 1 })
    },
  }
}
