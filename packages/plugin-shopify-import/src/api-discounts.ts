/**
 * Shopify discounts (`discountNodes`): code and automatic, every kind, read
 * with just enough detail to rebuild the ones our discount model can express
 * and to say why the others cannot be. Codes past the first page are read
 * separately, up to `MAX_CODES` per discount.
 */
import type { ShopifyClient } from './shopify-client'
import type { NDiscount } from './types'

type Page<N> = { nodes: N[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }
const PAGE_INFO = 'pageInfo { hasNextPage endCursor }'

/** Shopify allows millions of codes on one discount; more than this is reported, not imported. */
export const MAX_CODES = 1000

const GETS = `customerGets {
  value { __typename
    ... on DiscountPercentage { percentage }
    ... on DiscountAmount { amount { amount } appliesOnEachItem }
  }
  items { __typename
    ... on DiscountProducts { products(first: 100) { ${PAGE_INFO} nodes { id } } productVariants(first: 1) { nodes { id } } }
    ... on DiscountCollections { collections(first: 100) { ${PAGE_INFO} nodes { id } } }
  }
}`
const MINIMUM = `minimumRequirement { __typename
  ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount } }
  ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
}`
const SHIPPING = `destinationSelection { __typename ... on DiscountCountries { countries includeRestOfWorld } }
  maximumShippingPrice { amount }`
const COMMON = 'title status startsAt endsAt asyncUsageCount'
const CODES = `usageLimit appliesOncePerCustomer customerSelection { __typename }
  codes(first: 50) { ${PAGE_INFO} nodes { code asyncUsageCount } }`

const DISCOUNTS_QUERY = `query Discounts($cursor: String) {
  discountNodes(first: 3, after: $cursor) {
    ${PAGE_INFO}
    nodes {
      id
      discount {
        __typename
        ... on DiscountCodeBasic { ${COMMON} ${CODES} ${GETS} ${MINIMUM} }
        ... on DiscountAutomaticBasic { ${COMMON} ${GETS} ${MINIMUM} }
        ... on DiscountCodeFreeShipping { ${COMMON} ${CODES} ${MINIMUM} ${SHIPPING} }
        ... on DiscountAutomaticFreeShipping { ${COMMON} ${MINIMUM} ${SHIPPING} }
        ... on DiscountCodeBxgy { ${COMMON} ${CODES} }
        ... on DiscountAutomaticBxgy { ${COMMON} }
        ... on DiscountCodeApp { ${COMMON} ${CODES} }
        ... on DiscountAutomaticApp { ${COMMON} }
      }
    }
  }
}`

const DISCOUNT_CODES_QUERY = `query DiscountCodes($id: ID!, $cursor: String) {
  codeDiscountNode(id: $id) {
    codeDiscount { __typename
      ... on DiscountCodeBasic { codes(first: 250, after: $cursor) { ${PAGE_INFO} nodes { code asyncUsageCount } } }
      ... on DiscountCodeFreeShipping { codes(first: 250, after: $cursor) { ${PAGE_INFO} nodes { code asyncUsageCount } } }
      ... on DiscountCodeBxgy { codes(first: 250, after: $cursor) { ${PAGE_INFO} nodes { code asyncUsageCount } } }
      ... on DiscountCodeApp { codes(first: 250, after: $cursor) { ${PAGE_INFO} nodes { code asyncUsageCount } } }
    }
  }
}`

type GCode = { code: string; asyncUsageCount: number | null }

export type GDiscount = {
  __typename: string
  title: string
  status: string
  startsAt: string | null
  endsAt: string | null
  asyncUsageCount?: number | null
  usageLimit?: number | null
  appliesOncePerCustomer?: boolean | null
  customerSelection?: { __typename: string } | null
  codes?: Page<GCode>
  customerGets?: {
    value: {
      __typename: string
      percentage?: number
      amount?: { amount: string }
      appliesOnEachItem?: boolean
    }
    items: {
      __typename: string
      products?: Page<{ id: string }>
      productVariants?: { nodes: { id: string }[] }
      collections?: Page<{ id: string }>
    }
  } | null
  minimumRequirement?: {
    __typename: string
    greaterThanOrEqualToSubtotal?: { amount: string }
    greaterThanOrEqualToQuantity?: string
  } | null
  destinationSelection?: {
    __typename: string
    countries?: string[]
    includeRestOfWorld?: boolean
  } | null
  maximumShippingPrice?: { amount: string } | null
}

const paise = (amount: string | undefined | null): number => Math.round(Number(amount ?? 0) * 100)

function itemsOf(d: GDiscount): NDiscount['items'] {
  const items = d.customerGets?.items
  if (items?.__typename === 'DiscountProducts') {
    return {
      kind: 'products',
      ids: items.products?.nodes.map((n) => n.id) ?? [],
      variants: (items.productVariants?.nodes.length ?? 0) > 0,
      more: items.products?.pageInfo.hasNextPage ?? false,
    }
  }
  if (items?.__typename === 'DiscountCollections') {
    return {
      kind: 'collections',
      ids: items.collections?.nodes.map((n) => n.id) ?? [],
      more: items.collections?.pageInfo.hasNextPage ?? false,
    }
  }
  return { kind: 'all' }
}

function methodOf(d: GDiscount): Pick<NDiscount, 'method' | 'value' | 'appliesOnEachItem'> {
  if (d.__typename.endsWith('FreeShipping')) {
    return { method: 'free_shipping', value: 0, appliesOnEachItem: false }
  }
  const value = d.customerGets?.value
  if (value?.__typename === 'DiscountPercentage') {
    return {
      method: 'percent',
      value: Math.round((value.percentage ?? 0) * 10_000),
      appliesOnEachItem: false,
    }
  }
  if (value?.__typename === 'DiscountAmount') {
    return {
      method: 'fixed',
      value: paise(value.amount?.amount),
      appliesOnEachItem: Boolean(value.appliesOnEachItem),
    }
  }
  return { method: null, value: 0, appliesOnEachItem: false }
}

function mapDiscount(id: string, d: GDiscount): NDiscount {
  const min = d.minimumRequirement
  const dest = d.destinationSelection
  return {
    sourceId: id,
    title: d.title,
    kind: d.__typename.startsWith('DiscountCode') ? 'code' : 'automatic',
    typename: d.__typename,
    codes: (d.codes?.nodes ?? []).map((c) => ({ code: c.code, used: c.asyncUsageCount ?? 0 })),
    ...methodOf(d),
    items: itemsOf(d),
    minSubtotalPaise:
      min?.__typename === 'DiscountMinimumSubtotal'
        ? paise(min.greaterThanOrEqualToSubtotal?.amount)
        : null,
    minQuantity:
      min?.__typename === 'DiscountMinimumQuantity'
        ? Number(min.greaterThanOrEqualToQuantity ?? 0) || null
        : null,
    allCustomers: !d.customerSelection || d.customerSelection.__typename === 'DiscountCustomerAll',
    countries:
      dest?.__typename === 'DiscountCountries' && !dest.includeRestOfWorld
        ? (dest.countries ?? [])
        : 'all',
    maxShippingPaise: d.maximumShippingPrice ? paise(d.maximumShippingPrice.amount) : null,
    usageLimit: d.usageLimit ?? null,
    oncePerCustomer: Boolean(d.appliesOncePerCustomer),
    used: d.asyncUsageCount ?? 0,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
  }
}

/** Codes after the first page, until `MAX_CODES`. */
async function moreCodes(client: ShopifyClient, id: string, after: string | null) {
  const out: { code: string; used: number }[] = []
  for await (const nodes of client.paginate<GCode>(
    DISCOUNT_CODES_QUERY,
    (d) =>
      (d as { codeDiscountNode: { codeDiscount: { codes?: Page<GCode> } } | null }).codeDiscountNode
        ?.codeDiscount.codes ?? {
        nodes: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    { id },
    260,
    after,
  )) {
    out.push(...nodes.map((c) => ({ code: c.code, used: c.asyncUsageCount ?? 0 })))
    if (out.length >= MAX_CODES) break
  }
  return out
}

/** Every discount, with `truncatedCodes` set when Shopify holds more codes than we read. */
export async function* fetchDiscounts(
  client: ShopifyClient,
): AsyncGenerator<(NDiscount & { truncatedCodes: boolean })[]> {
  for await (const nodes of client.paginate<{ id: string; discount: GDiscount }>(
    DISCOUNTS_QUERY,
    (d) => (d as { discountNodes: Page<{ id: string; discount: GDiscount }> }).discountNodes,
    {},
    900,
  )) {
    const batch: (NDiscount & { truncatedCodes: boolean })[] = []
    for (const node of nodes) {
      const mapped = mapDiscount(node.id, node.discount)
      let truncated = false
      const page = node.discount.codes?.pageInfo
      if (page?.hasNextPage) {
        const more = await moreCodes(client, node.id, page.endCursor)
        mapped.codes.push(...more)
        truncated = mapped.codes.length >= MAX_CODES
        mapped.codes = mapped.codes.slice(0, MAX_CODES)
      }
      batch.push({ ...mapped, truncatedCodes: truncated })
    }
    yield batch
  }
}
