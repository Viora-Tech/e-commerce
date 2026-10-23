/**
 * Webhooks for the Koomerce migration app on Shopify, after the route checked
 * `X-Shopify-Hmac-Sha256` (`verifyShopifyWebhook`). One URL for the whole app (the toml's
 * `[[webhooks.subscriptions]]`), so the shop domain finds the stores (`platform_account`).
 *
 * - `app/uninstalled`, `shop/redact`: the shop's saved access goes from every store that
 *   installed the app on it. Imported records stay: they are the merchant's own store now.
 * - `customers/data_request`, `customers/redact`: the app keeps no copy of a Shopify
 *   customer outside the merchant's own store (what it imported belongs to that store, which
 *   answers its shoppers' requests itself), so these are acknowledged. Shopify requires
 *   every public app to accept all three privacy topics
 *   (shopify.dev/docs/apps/build/compliance/privacy-law-compliance).
 */
import { insertOutboxEvent, unlinkPlatformAccount } from '@commerce/core'
import { type Db, storesForPlatformAccount, withStore } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { shopifyConnection } from './schema'
import { normaliseShopDomain } from './shopify-client'

const SHOPIFY_APP_TOPICS = [
  'app/uninstalled',
  'shop/redact',
  'customers/data_request',
  'customers/redact',
] as const
export type ShopifyAppTopic = (typeof SHOPIFY_APP_TOPICS)[number]

export const isShopifyAppTopic = (t: string): t is ShopifyAppTopic =>
  (SHOPIFY_APP_TOPICS as readonly string[]).includes(t)

export type ShopifyWebhookOutcome = { topic: ShopifyAppTopic; stores: number; action: string }

export async function handleShopifyAppWebhook(
  db: Db,
  topic: ShopifyAppTopic,
  shopDomain: string,
): Promise<ShopifyWebhookOutcome> {
  const shop = normaliseShopDomain(shopDomain)
  if (topic === 'customers/data_request' || topic === 'customers/redact' || !shop)
    return { topic, stores: 0, action: 'acknowledged' }
  const stores = await storesForPlatformAccount(db, 'shopify', shop)
  for (const storeId of stores) {
    await withStore(db, storeId, async (tx) => {
      // RLS keeps this to the one store; a store that moved on to another shop keeps that one.
      await tx.delete(shopifyConnection).where(eq(shopifyConnection.shopDomain, shop))
      await unlinkPlatformAccount({ tx, storeId }, 'shopify')
      if (topic === 'app/uninstalled')
        await insertOutboxEvent(tx, storeId, 'shopify.app_uninstalled', {
          platform: 'shopify',
          externalId: shop,
        })
    })
  }
  return { topic, stores: stores.length, action: 'access removed' }
}
