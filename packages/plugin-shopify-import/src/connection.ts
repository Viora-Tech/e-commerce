/** The store's Shopify connection: domain plus an encrypted custom-app Admin API token. */
import { decryptSecret, encryptSecret } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { shopifyConnection } from './schema'
import { type ClientOptions, normaliseShopDomain, ShopifyClient } from './shopify-client'

const ERRORS = {
  domain: 'Enter your store address, like your-store.myshopify.com',
  token: 'That does not look like an Admin API access token (it starts with shpat_)',
}

/** A domain or token the merchant can fix; the router answers 400 with the message. */
export class ConnectionError extends Error {}

export type ConnectionView = {
  shopDomain: string
  shopName: string | null
  /** `shpat_••••1234`: enough to recognise, never enough to use. */
  tokenHint: string
  verifiedAt: Date | null
}

export function maskToken(token: string): string {
  const prefix = /^shp[a-z]+_/.exec(token)?.[0] ?? ''
  return `${prefix}••••${token.slice(-4)}`
}

export async function getConnection(tx: StoreTx, secret: string): Promise<ConnectionView | null> {
  const [row] = await tx.select().from(shopifyConnection).limit(1)
  if (!row) return null
  let hint = '••••'
  try {
    hint = maskToken(decryptSecret(row.accessToken, secret))
  } catch {
    // A token saved under another secret still shows as connected; reconnecting fixes it.
  }
  return {
    shopDomain: row.shopDomain,
    shopName: row.shopName,
    tokenHint: hint,
    verifiedAt: row.verifiedAt,
  }
}

/** A client for the store's saved connection, or null when there is none. */
export async function clientFor(
  tx: StoreTx,
  secret: string,
  opts: Pick<ClientOptions, 'fetch' | 'sleep'> = {},
): Promise<ShopifyClient | null> {
  const [row] = await tx.select().from(shopifyConnection).limit(1)
  if (!row) return null
  return new ShopifyClient({
    shopDomain: row.shopDomain,
    accessToken: decryptSecret(row.accessToken, secret),
    ...opts,
  })
}

export type ConnectInput = { shopDomain: string; accessToken: string }

/**
 * Check the token against Shopify (one `shop` query) and save it encrypted.
 * Throws a readable message when the domain or token is wrong.
 */
export async function connect(
  tx: StoreTx,
  storeId: string,
  input: ConnectInput,
  secret: string,
  fetchImpl?: typeof fetch,
): Promise<ConnectionView> {
  const shopDomain = normaliseShopDomain(input.shopDomain)
  if (!shopDomain) throw new ConnectionError(ERRORS.domain)
  const accessToken = input.accessToken.trim()
  if (!/^shp[a-z]+_[a-z0-9]{16,}$/i.test(accessToken)) throw new ConnectionError(ERRORS.token)
  const client = new ShopifyClient({
    shopDomain,
    accessToken,
    maxAttempts: 2,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  })
  const data = await client.query<{ shop: { name: string } }>(
    '{ shop { name myshopifyDomain } }',
    {},
    10,
  )
  const values = {
    shopDomain,
    accessToken: encryptSecret(accessToken, secret),
    shopName: data.shop.name,
    verifiedAt: new Date(),
    updatedAt: new Date(),
  }
  const [existing] = await tx.select({ id: shopifyConnection.id }).from(shopifyConnection)
  if (existing) {
    await tx.update(shopifyConnection).set(values).where(eq(shopifyConnection.id, existing.id))
  } else {
    await tx.insert(shopifyConnection).values({ storeId, ...values })
  }
  return {
    shopDomain,
    shopName: data.shop.name,
    tokenHint: maskToken(accessToken),
    verifiedAt: values.verifiedAt,
  }
}

export async function disconnect(tx: StoreTx): Promise<void> {
  await tx.delete(shopifyConnection)
}
