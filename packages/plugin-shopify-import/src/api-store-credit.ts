/**
 * Shopify store credit accounts (issue #1227). Shopify has no list of accounts, only each
 * customer's `storeCreditAccounts` (one per currency), so this reads customers with their
 * accounts: a bulk operation for the whole store, else page by page. Needs
 * `read_store_credit_accounts`; without it Shopify answers ACCESS_DENIED, which the client
 * raises as a `scope` error for `write-store-credit.ts` to report.
 */
import { bulkOrPaged, runBulkQuery, streamBulkRoots, streamJsonl } from './bulk'
import { BULK_BATCH_SIZE, PAGE_INFO, type Page } from './shopify-api'
import type { ShopifyClient } from './shopify-client'
import type { NStoreCreditAccount } from './types'

const ACCOUNT_FIELDS = 'id balance { amount currencyCode }'

/** 50 customers with up to 5 accounts each stays far below Shopify's 1,000 cost limit. */
const STORE_CREDIT_QUERY = `query StoreCredit($cursor: String) {
  customers(first: 50, after: $cursor, sortKey: ID) {
    ${PAGE_INFO}
    nodes {
      id email firstName lastName
      storeCreditAccounts(first: 5) { nodes { ${ACCOUNT_FIELDS} } }
    }
  }
}`

const STORE_CREDIT_BULK_QUERY = `{
  customers {
    edges {
      node {
        id email firstName lastName
        storeCreditAccounts { edges { node { ${ACCOUNT_FIELDS} } } }
      }
    }
  }
}`

type GAccount = { id: string; balance: { amount: string; currencyCode: string } }

type GCustomer = {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
  storeCreditAccounts: { nodes: GAccount[] } | null
}

const paise = (amount: string) => Math.round(Number(amount) * 100)

function mapStoreCredit(c: GCustomer): NStoreCreditAccount[] {
  const owner = {
    sourceId: c.id,
    email: c.email?.toLowerCase() || null,
    name: [c.firstName, c.lastName].filter(Boolean).join(' ') || null,
  }
  return (c.storeCreditAccounts?.nodes ?? []).map((a) => ({
    sourceId: a.id,
    balancePaise: paise(a.balance.amount),
    currency: a.balance.currencyCode,
    customer: owner,
  }))
}

const ACCOUNTS = { field: 'storeCreditAccounts', asPage: false }

async function* fetchBulk(client: ShopifyClient): AsyncGenerator<NStoreCreditAccount[]> {
  const url = await runBulkQuery(client, STORE_CREDIT_BULK_QUERY)
  if (!url) return
  for await (const nodes of streamBulkRoots<GCustomer>(
    streamJsonl(url, client.fetchImpl),
    (type) => (type === 'StoreCreditAccount' ? ACCOUNTS : null),
    [ACCOUNTS],
    BULK_BATCH_SIZE,
  )) {
    yield nodes.flatMap(mapStoreCredit)
  }
}

async function* fetchPaged(client: ShopifyClient): AsyncGenerator<NStoreCreditAccount[]> {
  for await (const nodes of client.paginate<GCustomer>(
    STORE_CREDIT_QUERY,
    (d) => (d as { customers: Page<GCustomer> }).customers,
    {},
    350,
  )) {
    yield nodes.flatMap(mapStoreCredit)
  }
}

/** Every customer's store credit accounts, a page of customers at a time. */
export function fetchStoreCredit(
  client: ShopifyClient,
  onBulkFallback?: (reason: unknown) => void,
): AsyncGenerator<NStoreCreditAccount[]> {
  return bulkOrPaged(
    () => fetchBulk(client),
    () => fetchPaged(client),
    onBulkFallback,
  )
}
