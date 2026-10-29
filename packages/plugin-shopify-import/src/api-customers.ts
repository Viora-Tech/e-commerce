/** Customers from the Admin GraphQL API, in bulk or page by page. */
import { bulkOrPaged, runBulkQuery, streamBulkRoots, streamJsonl } from './bulk'
import { BULK_BATCH_SIZE, PAGE_INFO, type Page } from './shopify-api'
import type { ShopifyClient } from './shopify-client'
import type { NAddress, NCustomer } from './types'

const CUSTOMERS_QUERY = `query Customers($cursor: String, $query: String) {
  customers(first: 100, after: $cursor, sortKey: ID, query: $query) {
    ${PAGE_INFO}
    nodes {
      id email phone firstName lastName tags note createdAt
      emailMarketingConsent { marketingState }
      smsMarketingConsent { marketingState }
      defaultAddress { firstName lastName company address1 address2 city province provinceCode country countryCodeV2 zip phone }
    }
  }
}`

export type GAddress = {
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  company: string | null
  address1: string | null
  address2: string | null
  city: string | null
  province: string | null
  provinceCode: string | null
  country?: string | null
  countryCodeV2: string | null
  zip: string | null
  phone: string | null
}

type GCustomer = {
  id: string
  email: string | null
  phone: string | null
  firstName: string | null
  lastName: string | null
  tags: string[]
  note: string | null
  createdAt: string | null
  emailMarketingConsent: { marketingState: string } | null
  smsMarketingConsent: { marketingState: string } | null
  defaultAddress: GAddress | null
}

export function mapAddress(a: GAddress | null): NAddress | null {
  if (!a?.address1) return null
  return {
    name: a.name ?? [a.firstName, a.lastName].filter(Boolean).join(' '),
    company: a.company || null,
    line1: a.address1,
    line2: a.address2 || null,
    city: a.city ?? '',
    province: a.province || null,
    provinceCode: a.provinceCode || null,
    country: a.country ?? null,
    countryCode: a.countryCodeV2 || null,
    zip: a.zip ?? '',
    phone: a.phone || null,
  }
}

export function mapCustomer(c: GCustomer): NCustomer {
  return {
    sourceId: c.id,
    email: c.email?.toLowerCase() || null,
    phone: c.phone || null,
    firstName: c.firstName || null,
    lastName: c.lastName || null,
    acceptsMarketing: c.emailMarketingConsent?.marketingState === 'SUBSCRIBED',
    acceptsSmsMarketing: c.smsMarketingConsent?.marketingState === 'SUBSCRIBED',
    tags: c.tags,
    note: c.note || null,
    address: mapAddress(c.defaultAddress),
    createdAt: c.createdAt,
  }
}

const CUSTOMERS_BULK_QUERY = `{
  customers {
    edges {
      node {
        id email phone firstName lastName tags note createdAt
        emailMarketingConsent { marketingState }
        smsMarketingConsent { marketingState }
        defaultAddress { firstName lastName company address1 address2 city province provinceCode country countryCodeV2 zip phone }
      }
    }
  }
}`

async function* fetchCustomersBulk(client: ShopifyClient): AsyncGenerator<NCustomer[]> {
  const url = await runBulkQuery(client, CUSTOMERS_BULK_QUERY)
  if (!url) return
  for await (const nodes of streamBulkRoots<GCustomer>(
    streamJsonl(url, client.fetchImpl),
    () => null,
    [],
    BULK_BATCH_SIZE,
  )) {
    yield nodes.map(mapCustomer)
  }
}

async function* fetchCustomersPaged(
  client: ShopifyClient,
  search: string | null = null,
): AsyncGenerator<NCustomer[]> {
  for await (const nodes of client.paginate<GCustomer>(
    CUSTOMERS_QUERY,
    (d) => (d as { customers: Page<GCustomer> }).customers,
    { query: search },
    300,
  )) {
    yield nodes.map(mapCustomer)
  }
}

export async function* fetchCustomers(
  client: ShopifyClient,
  onBulkFallback?: (reason: unknown) => void,
  /** Only what matches (`updated_at:>'…'`): read page by page, no bulk operation. */
  search: string | null = null,
): AsyncGenerator<NCustomer[]> {
  if (search) {
    yield* fetchCustomersPaged(client, search)
    return
  }
  yield* bulkOrPaged(
    () => fetchCustomersBulk(client),
    () => fetchCustomersPaged(client),
    onBulkFallback,
  )
}
