/**
 * A stateful fake Admin API for customers, orders and products that answers
 * both ways the importer reads them: Bulk Operations (with an artificial
 * export delay, the way Shopify takes a while to prepare a big store) and
 * paged queries, honouring `query: "updated_at:>'…'"`. Every call is logged
 * so a test can tell full reads from "changed since" reads. Never touches the
 * network.
 */
import { json } from '../helpers'

const OLD = '2020-01-01T00:00:00Z'
const money = (amount: string) => ({ shopMoney: { amount } })
const cost = {
  requestedQueryCost: 10,
  throttleStatus: { maximumAvailable: 20000, currentlyAvailable: 19000, restoreRate: 1000 },
}

type Node = Record<string, unknown> & { id: string; updatedAt: string }

export function customerNode(i: number, overrides: Partial<Node> = {}): Node {
  return {
    id: `gid://shopify/Customer/${i}`,
    email: `shopper${i}@example.com`,
    phone: null,
    firstName: `Shopper`,
    lastName: `${i}`,
    tags: [],
    note: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: OLD,
    emailMarketingConsent: { marketingState: i % 2 ? 'SUBSCRIBED' : 'NOT_SUBSCRIBED' },
    smsMarketingConsent: null,
    defaultAddress: null,
    ...overrides,
  }
}

export function orderNode(i: number, customers: number, overrides: Partial<Node> = {}): Node {
  const c = (i % customers) + 1
  return {
    id: `gid://shopify/Order/${i}`,
    name: `#${1000 + i}`,
    email: `shopper${c}@example.com`,
    phone: null,
    createdAt: '2025-06-01T08:00:00Z',
    updatedAt: OLD,
    cancelledAt: null,
    displayFinancialStatus: 'PAID',
    displayFulfillmentStatus: 'FULFILLED',
    currencyCode: 'INR',
    tags: [],
    note: null,
    paymentGatewayNames: ['razorpay'],
    discountCodes: [],
    subtotalPriceSet: money('999.00'),
    totalShippingPriceSet: money('0.00'),
    totalTaxSet: money('152.39'),
    totalPriceSet: money('999.00'),
    totalDiscountsSet: money('0.00'),
    totalRefundedSet: money('0.00'),
    customer: { firstName: 'Shopper', lastName: `${c}` },
    shippingAddress: null,
    lineItems: {
      nodes: [
        {
          id: `gid://shopify/LineItem/${i}`,
          title: 'Tee',
          variantTitle: null,
          sku: 'TEE-1',
          quantity: 1,
          taxable: true,
          unfulfilledQuantity: 0,
          originalUnitPriceSet: money('999.00'),
          product: { handle: 'tee' },
        },
      ],
    },
    ...overrides,
  }
}

export function productNode(i: number, overrides: Partial<Node> = {}): Node {
  return {
    id: `gid://shopify/Product/${i}`,
    handle: i === 1 ? 'tee' : `product-${i}`,
    title: i === 1 ? 'Tee' : `Product ${i}`,
    descriptionHtml: '',
    vendor: 'Waimers',
    productType: null,
    tags: [],
    status: 'ACTIVE',
    updatedAt: OLD,
    seo: null,
    options: [{ name: 'Title', position: 1 }],
    hsn: null,
    media: { nodes: [] },
    variants: {
      pageInfo: { hasNextPage: false, endCursor: null },
      nodes: [
        {
          id: `gid://shopify/ProductVariant/${i}`,
          title: 'Default Title',
          sku: i === 1 ? 'TEE-1' : `SKU-${i}`,
          barcode: null,
          price: '999.00',
          compareAtPrice: null,
          taxable: true,
          inventoryQuantity: 10,
          selectedOptions: [{ name: 'Title', value: 'Default Title' }],
          image: null,
          inventoryItem: {
            tracked: true,
            harmonizedSystemCode: null,
            unitCost: null,
            measurement: null,
          },
        },
      ],
    },
    ...overrides,
  }
}

type Resource = 'products' | 'customers' | 'orders'
const PAGE: Record<Resource, number> = { products: 25, customers: 100, orders: 50 }
const OP: Record<string, Resource> = {
  Products: 'products',
  Customers: 'customers',
  Orders: 'orders',
}

export type Call = { op: string; search: string | null }

/** Flatten a node into Shopify's bulk JSONL lines: nested connections become child lines. */
function bulkLines(resource: Resource, node: Node): Record<string, unknown>[] {
  const { variants, media, lineItems, ...rest } = node as Record<string, unknown> & Node
  const lines: Record<string, unknown>[] = [rest]
  const children =
    resource === 'products'
      ? [
          ...((variants as { nodes: Node[] } | undefined)?.nodes ?? []),
          ...((media as { nodes: Node[] } | undefined)?.nodes ?? []),
        ]
      : resource === 'orders'
        ? ((lineItems as { nodes: Node[] } | undefined)?.nodes ?? [])
        : []
  for (const child of children) lines.push({ ...child, __parentId: node.id })
  return lines
}

export function fakeShopify(opts: { customers: number; orders: number; products: number }) {
  const data: Record<Resource, Node[]> = {
    customers: Array.from({ length: opts.customers }, (_, i) => customerNode(i + 1)),
    orders: Array.from({ length: opts.orders }, (_, i) => orderNode(i + 1, opts.customers)),
    products: Array.from({ length: opts.products }, (_, i) => productNode(i + 1)),
  }
  const calls: Call[] = []
  /** How long Shopify takes to prepare each bulk export. */
  const state = { bulkDelayMs: 0, op: null as null | { id: string; readyAt: number; url: string } }
  let ops = 0

  const changedAfter = (search: string | null) => {
    const m = search ? /updated_at:>'([^']+)'/.exec(search) : null
    return m?.[1] ? new Date(m[1]).getTime() : null
  }

  const graphql = (query: string, variables: Record<string, unknown>): Response => {
    if (query.includes('bulkOperationRunQuery')) {
      const resource = /^\{\s*(\w+)/.exec(String(variables.query))?.[1] as Resource
      calls.push({ op: `bulk:${resource}`, search: null })
      ops++
      const id = `gid://shopify/BulkOperation/${ops}`
      state.op = {
        id,
        readyAt: Date.now() + state.bulkDelayMs,
        url: `https://bulk.test/${resource}-${ops}.jsonl`,
      }
      return json({
        data: {
          bulkOperationRunQuery: { bulkOperation: { id, status: 'CREATED' }, userErrors: [] },
        },
        extensions: { cost },
      })
    }
    if (query.includes('currentBulkOperation')) {
      const op = state.op
      const done = op ? Date.now() >= op.readyAt : false
      return json({
        data: {
          currentBulkOperation: op
            ? {
                id: op.id,
                status: done ? 'COMPLETED' : 'RUNNING',
                errorCode: null,
                url: done ? op.url : null,
                partialDataUrl: null,
              }
            : null,
        },
        extensions: { cost },
      })
    }
    const name = /query (\w+)/.exec(query)?.[1] ?? 'Shop'
    if (name === 'VariantStock') {
      calls.push({ op: name, search: null })
      return json({
        data: {
          productVariants: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: data.products.flatMap((p) =>
              (p.variants as { nodes: { id: string; inventoryQuantity: number }[] }).nodes.map(
                (v) => ({
                  id: v.id,
                  inventoryQuantity: v.inventoryQuantity,
                  inventoryItem: { tracked: true },
                }),
              ),
            ),
          },
        },
        extensions: { cost },
      })
    }
    const resource = OP[name]
    if (!resource) {
      return json({
        data: { shop: { name: 'Waimers', myshopifyDomain: 'waimers.myshopify.com' } },
        extensions: { cost },
      })
    }
    const search = (variables.query as string | null | undefined) ?? null
    calls.push({ op: name, search })
    const after = changedAfter(search)
    const all = data[resource].filter(
      (n) => after === null || new Date(n.updatedAt).getTime() > after,
    )
    const start = Number(variables.cursor ?? 0)
    const nodes = all.slice(start, start + PAGE[resource])
    const end = start + nodes.length
    return json({
      data: {
        [resource]: {
          pageInfo: {
            hasNextPage: end < all.length,
            endCursor: end < all.length ? String(end) : null,
          },
          nodes,
        },
      },
      extensions: { cost },
    })
  }

  /** Serves the bulk JSONL downloads; everything else goes to `inner` (GraphQL, images). */
  const wrap = (inner: typeof fetch): typeof fetch =>
    (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const m = /^https:\/\/bulk\.test\/(\w+)-\d+\.jsonl$/.exec(url)
      if (m) {
        const resource = m[1] as Resource
        calls.push({ op: `download:${resource}`, search: null })
        const body = data[resource].flatMap((n) =>
          bulkLines(resource, n).map((l) => JSON.stringify(l)),
        )
        return new Response(body.join('\n'), { headers: { 'content-type': 'application/jsonl' } })
      }
      return inner(input, init)
    }) as typeof fetch

  return { data, calls, state, graphql, wrap }
}
