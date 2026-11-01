#!/usr/bin/env bun
import { loadEnv } from '@commerce/config'
/**
 * Empties a store of what a Shopify import brings back, so the next import starts afresh:
 * products, collections, customers and orders, with everything hanging off them (payments,
 * refunds, shipments, invoices, returns, carts, reviews, stock, purchase orders, discounts,
 * gift cards, pages, posts, menus, redirects, extra fields and content entries), plus the import
 * mappings for those. A store whose data was only ever test data can be re-imported clean.
 *
 * Keeps the store and everything set up around it: settings, themes, Files (with their import
 * mappings, so the next import re-links product images instead of copying them twice), domains,
 * staff and roles, apps, payment and shipping setup, markets, GST settings, automations and
 * campaigns. The privacy audit trail of the removed customers goes with them, under the same
 * guard as closing a store (`app.store_delete`, migration 0078).
 *
 * Dry run by default: every delete runs in the store's transaction (RLS-scoped), which is then
 * rolled back, so the counts are exact and nothing changes.
 *
 *   bun scripts/reset-store-data.ts --store <id|slug>           # dry run: rows per table
 *   bun scripts/reset-store-data.ts --store <id|slug> --apply   # delete for good
 */
import { deletionOrder, listStoreTables } from '@commerce/core'
import { createDb, type StoreTx, store, withStore } from '@commerce/db'
import { eq, or, sql } from 'drizzle-orm'

/** What a Shopify import re-creates, and the rows that point at it. */
const WIPE = [
  // Catalogue
  'product',
  'variant',
  'product_option',
  'product_option_value',
  'variant_option_value',
  'product_media',
  'variant_media',
  'collection',
  'collection_product',
  'metafield',
  'metaobject',
  'channel_listing',
  'translation',
  // Orders and money
  'order',
  'order_line',
  'order_note',
  'address',
  'payment',
  'payment_event',
  'refund',
  'fulfillment_order',
  'fulfillment_order_line',
  'return_request',
  'return_request_line',
  'notification',
  'outbox_event',
  'invoice',
  'invoice_line',
  'invoice_batch',
  'invoice_period',
  // Carts, discounts, gift cards
  'cart',
  'cart_line',
  'discount',
  'discount_usage',
  'gift_card',
  'gift_card_transaction',
  // Customers
  'customer',
  'customer_note',
  'customer_address',
  'customer_identity',
  'customer_login_code',
  'customer_login_ticket',
  'customer_otp',
  'customer_passkey',
  'customer_session',
  'newsletter_signup',
  'contact_message',
  'cookie_consent',
  'data_request',
  'marketing_consent_event',
  'privacy_audit_event',
  // Stock and purchasing
  'inventory_level',
  'inventory_adjustment',
  'transfer',
  'transfer_line',
  'purchase_order',
  'purchase_order_line',
  'purchase_order_receipt',
  'purchase_order_receipt_line',
  'purchase_charge',
  'purchase_charge_split',
  'purchase_document',
  'inbound_shipment',
  // Shipping
  'shipment',
  'shipment_pickup',
  'shipment_manifest',
  'shipment_webhook_event',
  'courier_order',
  // Content
  'page',
  'blog',
  'article',
  'navigation_menu',
  'url_redirect',
  // Apps, growth, automations, inbox and AI work on the rows above
  'review',
  'review_media',
  'review_request',
  'back_in_stock_signup',
  'back_in_stock_usage',
  'affiliate_commission',
  'affiliate_payout',
  'affiliate_click_day',
  'marketing_automation_run',
  'marketing_message',
  'marketing_session',
  'web_vital',
  'product_view',
  // Search & discovery: events, search pins and picked recommendations point at products
  'discovery_event',
  'search_pin',
  'product_recommendation',
  'automation_run',
  'automation_run_record',
  'automation_step_run',
  'inbox_conversation',
  'inbox_message',
  'inbox_ai_event',
  'ai_job',
  'ai_job_item',
  'ai_action',
  // Earlier imports
  'shopify_import_run',
  'shopify_import_issue',
] as const

/** Import mappings that point at rows this keeps: Files, and the extra-field definitions. */
const KEPT_MAPPINGS = ['media', 'files', 'metafield_definitions', 'metaobject_definitions']

class DryRun extends Error {
  constructor(readonly counts: Record<string, number>) {
    super('dry run')
  }
}

const UUID = /^[0-9a-f-]{36}$/i

/** Deletes the store's rows in `WIPE`, children first; rows removed per table. */
async function wipe(tx: StoreTx, storeId: string): Promise<Record<string, number>> {
  const all = await listStoreTables(tx)
  const wanted = new Set<string>(WIPE)
  const missing = WIPE.filter((t) => !all.tables.includes(t))
  if (missing.length) throw new Error(`not store tables (renamed?): ${missing.join(', ')}`)
  const order = deletionOrder({
    tables: all.tables.filter((t) => wanted.has(t)),
    edges: all.edges.filter(([child, parent]) => wanted.has(child) && wanted.has(parent)),
  })
  // Lets the append-only privacy audit trail of these customers go (migration 0078).
  await tx.execute(sql`select set_config('app.store_delete', ${storeId}, true)`)
  const counts: Record<string, number> = {}
  for (const table of order) {
    const result = await tx.execute(
      sql`delete from ${sql.identifier(table)} where store_id = ${storeId}`,
    )
    const n = Number((result as { count?: number }).count ?? 0)
    if (n > 0) counts[table] = n
  }
  const mappings = await tx.execute(sql`
    delete from shopify_import_mapping
    where store_id = ${storeId}
      and resource not in (${sql.join(
        KEPT_MAPPINGS.map((m) => sql`${m}`),
        sql`, `,
      )})
  `)
  const m = Number((mappings as { count?: number }).count ?? 0)
  if (m > 0) counts['shopify_import_mapping (re-imported resources)'] = m
  return counts
}

async function main() {
  const env = loadEnv(process.env)
  const apply = process.argv.includes('--apply')
  const at = process.argv.indexOf('--store')
  const wanted = at > 0 ? process.argv[at + 1] : undefined
  if (!wanted) {
    console.error('reset-store-data: pass --store <id|slug> (add --apply to delete)')
    process.exit(2)
  }
  // The owner connection finds the store; the wipe runs store-scoped (RLS) on the app one.
  const owner = createDb(env.DATABASE_URL_OWNER)
  const app = createDb(env.DATABASE_URL)
  const [found] = await owner
    .select({ id: store.id, slug: store.slug, name: store.name })
    .from(store)
    .where(
      UUID.test(wanted) ? or(eq(store.id, wanted), eq(store.slug, wanted)) : eq(store.slug, wanted),
    )
  if (!found) {
    console.error(`reset-store-data: no store ${wanted}`)
    process.exit(2)
  }
  console.log(
    `reset-store-data: ${apply ? 'APPLY' : 'dry run'} — ${found.name} (${found.slug}, ${found.id})`,
  )

  let counts: Record<string, number>
  if (apply) {
    counts = await withStore(app, found.id, (tx) => wipe(tx, found.id))
  } else {
    try {
      await withStore(app, found.id, async (tx) => {
        throw new DryRun(await wipe(tx, found.id))
      })
      throw new Error('unreachable')
    } catch (err) {
      if (!(err instanceof DryRun)) throw err
      counts = err.counts
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  for (const [table, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${table.padEnd(48)} ${n}`)
  }
  console.log(
    `reset-store-data: ${total} row(s) ${apply ? 'deleted' : 'would be deleted (rolled back)'}.`,
  )
  await owner.$client.end()
  await app.$client.end()
}

main().catch((err) => {
  console.error(`reset-store-data: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
