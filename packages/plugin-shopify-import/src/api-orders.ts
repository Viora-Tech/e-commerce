/** Orders from the Admin GraphQL API, in bulk or page by page. */
import { type GAddress, mapAddress } from './api-customers'
import { bulkOrPaged, runBulkQuery, streamBulkRoots, streamJsonl } from './bulk'
import { BULK_BATCH_SIZE, type Money, money, PAGE_INFO, type Page } from './shopify-api'
import type { ShopifyClient } from './shopify-client'
import type { NOrder } from './types'

const ORDERS_QUERY = `query Orders($cursor: String, $query: String) {
  orders(first: 50, after: $cursor, sortKey: CREATED_AT, query: $query) {
    ${PAGE_INFO}
    nodes {
      id name email phone createdAt cancelledAt displayFinancialStatus displayFulfillmentStatus
      fulfillments(first: 20) { displayStatus }
      currencyCode tags note paymentGatewayNames discountCodes
      subtotalPriceSet { shopMoney { amount } }
      totalShippingPriceSet { shopMoney { amount } }
      totalTaxSet { shopMoney { amount } }
      totalPriceSet { shopMoney { amount } }
      totalDiscountsSet { shopMoney { amount } }
      totalRefundedSet { shopMoney { amount } }
      customer { firstName lastName }
      shippingAddress { name company address1 address2 city province provinceCode countryCodeV2 zip phone }
      lineItems(first: 50) {
        nodes {
          title variantTitle sku quantity taxable unfulfilledQuantity
          originalUnitPriceSet { shopMoney { amount } }
          product { handle }
        }
      }
    }
  }
}`

type GOrder = {
  id: string
  name: string
  email: string | null
  phone: string | null
  createdAt: string
  cancelledAt: string | null
  displayFinancialStatus: string | null
  displayFulfillmentStatus: string | null
  /** Each parcel's delivery stage ("LABEL_PRINTED", "IN_TRANSIT", "DELIVERED"…). */
  fulfillments?: { displayStatus: string | null }[] | null
  currencyCode: string | null
  tags: string[]
  note: string | null
  paymentGatewayNames: string[]
  discountCodes: string[]
  subtotalPriceSet: Money
  totalShippingPriceSet: Money
  totalTaxSet: Money
  totalPriceSet: Money
  totalDiscountsSet: Money
  totalRefundedSet: Money
  customer: { firstName: string | null; lastName: string | null } | null
  shippingAddress: GAddress | null
  lineItems: {
    nodes: {
      title: string
      variantTitle: string | null
      sku: string | null
      quantity: number
      taxable: boolean
      unfulfilledQuantity: number
      originalUnitPriceSet: Money
      product: { handle: string } | null
    }[]
  }
  /** Shopify's timeline (bulk reads only: page by page it would cost too much per order). */
  events?: { nodes: { createdAt: string; message: string | null }[] }
}

/**
 * Our subtotal is before the discount (the discount is its own line, taken off it); Shopify's
 * `subtotalPrice` is already after it, so the order page took ₹460 off twice on #2369 (₹15,349
 * item, "Subtotal ₹14,889, Discount −₹460, Total ₹14,889"). The lines at their original prices
 * give the subtotal before discounts; with no lines, Shopify's subtotal plus its discounts (audit #11).
 */
function subtotalBeforeDiscounts(o: GOrder): number {
  const lines = o.lineItems.nodes
  if (lines.length > 0) {
    return lines.reduce((n, l) => n + l.quantity * money(l.originalUnitPriceSet), 0)
  }
  return money(o.subtotalPriceSet) + money(o.totalDiscountsSet)
}

/** Most events an imported order keeps; Shopify's longest timelines are notes and emails. */
const HISTORY_LIMIT = 50

/** Shopify's timeline as plain text, oldest first ("Confirmation #ABC was generated…"). */
function historyOf(o: GOrder): NOrder['history'] {
  if (!o.events) return undefined
  return o.events.nodes
    .map((e) => ({
      at: e.createdAt,
      message: (e.message ?? '')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300),
    }))
    .filter((e) => e.message)
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-HISTORY_LIMIT)
}

function mapOrder(o: GOrder): NOrder {
  const digits = o.name.match(/\d+/g)
  const number = digits ? Number(digits.join('')) : null
  return {
    sourceId: o.id,
    name: o.name,
    number: number && Number.isSafeInteger(number) && number < 2_000_000_000 ? number : null,
    email: o.email?.toLowerCase() || null,
    phone: o.phone || null,
    customerName: o.customer
      ? [o.customer.firstName, o.customer.lastName].filter(Boolean).join(' ') || null
      : (o.shippingAddress?.name ?? null),
    financialStatus: o.displayFinancialStatus?.toLowerCase() ?? null,
    fulfillmentStatus: o.displayFulfillmentStatus?.toLowerCase() ?? null,
    deliveryStatuses: o.fulfillments
      ? o.fulfillments.flatMap((f) => (f.displayStatus ? [f.displayStatus.toLowerCase()] : []))
      : undefined,
    currency: o.currencyCode,
    subtotalPaise: subtotalBeforeDiscounts(o),
    shippingPaise: money(o.totalShippingPriceSet),
    taxPaise: money(o.totalTaxSet),
    totalPaise: money(o.totalPriceSet),
    discountCode: o.discountCodes[0] ?? null,
    discountPaise: money(o.totalDiscountsSet),
    refundedPaise: money(o.totalRefundedSet),
    paymentMethod: o.paymentGatewayNames.join(', ') || null,
    paymentReference: null,
    createdAt: o.createdAt,
    cancelledAt: o.cancelledAt,
    tags: o.tags,
    note: o.note || null,
    shippingAddress: mapAddress(o.shippingAddress),
    history: historyOf(o),
    lines: o.lineItems.nodes
      .filter((l) => l.quantity > 0)
      .map((l) => ({
        title: l.title,
        variantTitle: l.variantTitle && l.variantTitle !== 'Default Title' ? l.variantTitle : null,
        sku: l.sku || null,
        productHandle: l.product?.handle ?? null,
        quantity: l.quantity,
        unitPricePaise: money(l.originalUnitPriceSet),
        fulfilledQuantity: Math.max(0, l.quantity - l.unfulfilledQuantity),
        taxable: l.taxable,
      })),
  }
}

const ORDERS_BULK_QUERY = `{
  orders {
    edges {
      node {
        id name email phone createdAt cancelledAt displayFinancialStatus displayFulfillmentStatus
        fulfillments { displayStatus }
        currencyCode tags note paymentGatewayNames discountCodes
        subtotalPriceSet { shopMoney { amount } }
        totalShippingPriceSet { shopMoney { amount } }
        totalTaxSet { shopMoney { amount } }
        totalPriceSet { shopMoney { amount } }
        totalDiscountsSet { shopMoney { amount } }
        totalRefundedSet { shopMoney { amount } }
        customer { firstName lastName }
        shippingAddress { name company address1 address2 city province provinceCode countryCodeV2 zip phone }
        lineItems {
          edges {
            node {
              id title variantTitle sku quantity taxable unfulfilledQuantity
              originalUnitPriceSet { shopMoney { amount } }
              product { handle }
            }
          }
        }
        events {
          edges { node { id createdAt message } }
        }
      }
    }
  }
}`

async function* fetchOrdersBulk(client: ShopifyClient): AsyncGenerator<NOrder[]> {
  const url = await runBulkQuery(client, ORDERS_BULK_QUERY)
  if (!url) return
  for await (const nodes of streamBulkRoots<GOrder>(
    streamJsonl(url, client.fetchImpl),
    (type) =>
      type === 'LineItem'
        ? { field: 'lineItems', asPage: false }
        : type.endsWith('Event')
          ? { field: 'events', asPage: false }
          : null,
    [{ field: 'lineItems', asPage: false }],
    BULK_BATCH_SIZE,
  )) {
    yield nodes.map(mapOrder)
  }
}

async function* fetchOrdersPaged(
  client: ShopifyClient,
  search: string | null = null,
): AsyncGenerator<NOrder[]> {
  for await (const nodes of client.paginate<GOrder>(
    ORDERS_QUERY,
    (d) => (d as { orders: Page<GOrder> }).orders,
    { query: search },
    1000,
  )) {
    yield nodes.map(mapOrder)
  }
}

/**
 * Orders are still written sequentially by `run.ts` (they resolve/create
 * customers through a shared cache), but reading them is just as safe to do
 * as one bulk op as products and customers are.
 */
export async function* fetchOrders(
  client: ShopifyClient,
  onBulkFallback?: (reason: unknown) => void,
  /** Only what matches (`updated_at:>'…'`): read page by page, no bulk operation. */
  search: string | null = null,
): AsyncGenerator<NOrder[]> {
  if (search) {
    yield* fetchOrdersPaged(client, search)
    return
  }
  yield* bulkOrPaged(
    () => fetchOrdersBulk(client),
    () => fetchOrdersPaged(client),
    onBulkFallback,
  )
}
