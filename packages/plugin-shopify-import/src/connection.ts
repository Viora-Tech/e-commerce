/**
 * The store's Shopify connection: domain plus credentials, encrypted like
 * every other stored secret. Two ways in:
 *  - `legacy`: a custom app's static Admin API token (`shpat_`). Shopify
 *    stopped allowing new legacy custom apps from 1 Jan 2026, but existing
 *    ones keep working.
 *  - `client_credentials`: a Dev Dashboard app's client ID and secret,
 *    installed on this store, exchanged for a ~24h Admin API access token
 *    (see `oauth.ts`). The token is cached alongside its expiry and
 *    refreshed automatically, here and mid-run on a 401.
 *
 * Both shapes live in the same `access_token` column as encrypted JSON, so no
 * migration was needed to add the new mode.
 */
import { decryptSecret, encryptSecret } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { AuthMode, ScopeCheck } from './client'
import { ALL_SCOPE_HANDLES, type ScopeHandle } from './client'
import { fetchClientCredentialsToken, isExpiring } from './oauth'
import type { InStore } from './runtime'
import { shopifyConnection } from './schema'
import { fetchShopAndScopes } from './shopify-api'
import { type ClientOptions, normaliseShopDomain, ShopifyClient } from './shopify-client'

const ERRORS = {
  domain: 'Enter your store address, like your-store.myshopify.com',
  token: 'That does not look like an Admin API access token (it starts with shpat_)',
  clientId: 'Enter the client ID from your app in the Dev Dashboard',
  clientSecret: 'Enter the client secret from your app in the Dev Dashboard',
}

/** A domain, token, or client ID/secret the merchant can fix; the router answers 400 with the message. */
export class ConnectionError extends Error {}

export type ConnectionView = {
  shopDomain: string
  shopName: string | null
  authMode: AuthMode
  /** `shpat_••••1234` (legacy) or the client ID (client credentials): enough to recognise, never enough to use. */
  tokenHint: string
  verifiedAt: Date | null
}

type Credential =
  | { mode: 'legacy'; token: string }
  | {
      mode: 'client_credentials'
      clientId: string
      clientSecret: string
      accessToken: string | null
      expiresAt: string | null
    }

export function maskToken(token: string): string {
  const prefix = /^shp[a-z]+_/.exec(token)?.[0] ?? ''
  return `${prefix}••••${token.slice(-4)}`
}

function decodeCredential(blob: string, secret: string): Credential {
  const decrypted = decryptSecret(blob, secret)
  try {
    const parsed = JSON.parse(decrypted) as Credential
    if (parsed.mode === 'legacy' || parsed.mode === 'client_credentials') return parsed
  } catch {
    // Not JSON: a raw token saved before client-credentials support existed.
  }
  return { mode: 'legacy', token: decrypted }
}

const encodeCredential = (cred: Credential, secret: string): string =>
  encryptSecret(JSON.stringify(cred), secret)

function hintFor(cred: Credential): string {
  if (cred.mode === 'legacy') return maskToken(cred.token)
  return `••••${cred.clientId.slice(-4)}`
}

export async function getConnection(tx: StoreTx, secret: string): Promise<ConnectionView | null> {
  const [row] = await tx.select().from(shopifyConnection).limit(1)
  if (!row) return null
  let cred: Credential = { mode: 'legacy', token: '' }
  let hint = '••••'
  try {
    cred = decodeCredential(row.accessToken, secret)
    hint = hintFor(cred)
  } catch {
    // A credential saved under another secret still shows as connected; reconnecting fixes it.
  }
  return {
    shopDomain: row.shopDomain,
    shopName: row.shopName,
    authMode: cred.mode,
    tokenHint: hint,
    verifiedAt: row.verifiedAt,
  }
}

/** Re-reads the row, exchanges a fresh token if needed, and persists it. Safe to call repeatedly. */
async function refreshClientCredentials(
  tx: StoreTx,
  secret: string,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  const [row] = await tx.select().from(shopifyConnection).limit(1)
  if (!row) return null
  const cred = decodeCredential(row.accessToken, secret)
  if (cred.mode !== 'client_credentials') return null
  if (!isExpiring(cred.expiresAt)) return cred.accessToken
  const token = await fetchClientCredentialsToken(
    row.shopDomain,
    cred.clientId,
    cred.clientSecret,
    fetchImpl,
  )
  const next: Credential = { ...cred, accessToken: token.accessToken, expiresAt: token.expiresAt }
  await tx
    .update(shopifyConnection)
    .set({ accessToken: encodeCredential(next, secret), updatedAt: new Date() })
    .where(eq(shopifyConnection.id, row.id))
  return token.accessToken
}

export type ClientForOptions = Pick<ClientOptions, 'fetch' | 'sleep'> & {
  /** Needed for a client-credentials connection to refresh and persist its token mid-run. */
  inStore?: InStore
}

/** A client for the store's saved connection, or null when there is none. */
export async function clientFor(
  tx: StoreTx,
  secret: string,
  opts: ClientForOptions = {},
): Promise<ShopifyClient | null> {
  const [row] = await tx.select().from(shopifyConnection).limit(1)
  if (!row) return null
  const { inStore, ...clientOpts } = opts
  const cred = decodeCredential(row.accessToken, secret)
  const fetchImpl = clientOpts.fetch ?? fetch
  if (cred.mode === 'legacy') {
    return new ShopifyClient({
      shopDomain: row.shopDomain,
      accessToken: cred.token,
      ...clientOpts,
    })
  }
  const refresh = async (): Promise<string> => {
    const token = inStore
      ? await inStore((tx2) => refreshClientCredentials(tx2, secret, fetchImpl))
      : (
          await fetchClientCredentialsToken(
            row.shopDomain,
            cred.clientId,
            cred.clientSecret,
            fetchImpl,
          )
        ).accessToken
    if (!token) throw new ConnectionError('Connect your Shopify store first')
    return token
  }
  const accessToken = isExpiring(cred.expiresAt) ? await refresh() : (cred.accessToken as string)
  return new ShopifyClient({
    shopDomain: row.shopDomain,
    accessToken,
    refreshToken: refresh,
    ...clientOpts,
  })
}

export type ConnectInput =
  | { shopDomain: string; accessToken: string }
  | { shopDomain: string; clientId: string; clientSecret: string }

async function saveConnection(
  tx: StoreTx,
  storeId: string,
  shopDomain: string,
  cred: Credential,
  shopName: string,
  secret: string,
): Promise<ConnectionView> {
  const values = {
    shopDomain,
    accessToken: encodeCredential(cred, secret),
    shopName,
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
    shopName,
    authMode: cred.mode,
    tokenHint: hintFor(cred),
    verifiedAt: values.verifiedAt,
  }
}

/**
 * Check the credentials against Shopify and save them encrypted. Legacy input
 * checks a static token with one `shop` query; client-credentials input
 * exchanges the client ID/secret for a token first, the same exchange used to
 * refresh it later. Throws a readable message when anything is wrong.
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
  const fetch_ = fetchImpl ?? globalThis.fetch

  if ('accessToken' in input) {
    const accessToken = input.accessToken.trim()
    if (!/^shp[a-z]+_[a-z0-9]{16,}$/i.test(accessToken)) throw new ConnectionError(ERRORS.token)
    const client = new ShopifyClient({ shopDomain, accessToken, maxAttempts: 2, fetch: fetch_ })
    const data = await client.query<{ shop: { name: string } }>(
      '{ shop { name myshopifyDomain } }',
      {},
      10,
    )
    return saveConnection(
      tx,
      storeId,
      shopDomain,
      { mode: 'legacy', token: accessToken },
      data.shop.name,
      secret,
    )
  }

  const clientId = input.clientId.trim()
  const clientSecret = input.clientSecret.trim()
  if (!clientId) throw new ConnectionError(ERRORS.clientId)
  if (!clientSecret) throw new ConnectionError(ERRORS.clientSecret)
  const token = await fetchClientCredentialsToken(shopDomain, clientId, clientSecret, fetch_)
  const client = new ShopifyClient({
    shopDomain,
    accessToken: token.accessToken,
    maxAttempts: 2,
    fetch: fetch_,
  })
  const data = await client.query<{ shop: { name: string } }>(
    '{ shop { name myshopifyDomain } }',
    {},
    10,
  )
  return saveConnection(
    tx,
    storeId,
    shopDomain,
    {
      mode: 'client_credentials',
      clientId,
      clientSecret,
      accessToken: token.accessToken,
      expiresAt: token.expiresAt,
    },
    data.shop.name,
    secret,
  )
}

export async function disconnect(tx: StoreTx): Promise<void> {
  await tx.delete(shopifyConnection)
}

/** Shop name plus which of the import's scopes the saved connection's token actually has. */
export async function testConnection(
  tx: StoreTx,
  secret: string,
  opts: ClientForOptions = {},
): Promise<ScopeCheck> {
  const client = await clientFor(tx, secret, opts)
  if (!client) throw new ConnectionError('Connect your Shopify store first')
  const { shopName, scopes } = await fetchShopAndScopes(client)
  const granted: ScopeHandle[] = ALL_SCOPE_HANDLES.filter((s) => scopes.includes(s))
  const missing: ScopeHandle[] = ALL_SCOPE_HANDLES.filter((s) => !scopes.includes(s))
  return { shopName, granted, missing }
}
