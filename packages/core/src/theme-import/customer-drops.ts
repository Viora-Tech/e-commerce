/** SOURCE OF TRUTH: the Liquid `customer` object — WHAT: the signed-in shopper in Shopify's shape (`customer`, `customer.default_address`) and their orders (`customer.orders`: line items, fulfilment and tracking, statuses with labels) / WHY: Shopify themes greet the shopper, list and track their orders from these; the storefront never caches a render that read them signed in */
import type { LiquidDataCache } from './cache'
import {
  imageDrop,
  type LiquidCustomerData,
  type LiquidFulfillmentData,
  type LiquidOrderData,
} from './drops'
import { numericId } from './numeric-id'

/** Shopify's `order.fulfillment_status` for ours: `fulfilled`, `partial`, `restocked` or `unfulfilled`. */
const FULFILLMENT_STATUS: Record<string, string> = {
  unfulfilled: 'unfulfilled',
  partially_fulfilled: 'partial',
  fulfilled: 'fulfilled',
  shipped: 'fulfilled',
  partially_delivered: 'fulfilled',
  delivered: 'fulfilled',
  returned: 'restocked',
}

/** What the shopper reads for our fulfilment status (`fulfillment_status_label`). */
const FULFILLMENT_LABEL: Record<string, string> = {
  unfulfilled: 'Unfulfilled',
  partially_fulfilled: 'Partially fulfilled',
  fulfilled: 'Packed',
  shipped: 'Shipped',
  partially_delivered: 'Partially delivered',
  delivered: 'Delivered',
  returned: 'Returned',
}

/** Shopify's `order.financial_status` for our payment status. */
const FINANCIAL_STATUS: Record<string, string> = {
  unpaid: 'pending',
  authorized: 'authorized',
  partially_paid: 'partially_paid',
  paid: 'paid',
  partially_refunded: 'partially_refunded',
  refunded: 'refunded',
  refund_needed: 'paid',
}

const FINANCIAL_LABEL: Record<string, string> = {
  pending: 'Pending',
  authorized: 'Authorized',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  partially_refunded: 'Partially refunded',
  refunded: 'Refunded',
}

/** First word, then the rest: Shopify keeps the two apart, we keep one name. */
function splitName(name: string | null): { first: string; last: string } {
  const [first = '', ...rest] = (name ?? '').trim().split(/\s+/)
  return { first, last: rest.join(' ') }
}

/** Shopify's `fulfillment` (on a line item): the courier, AWB and the courier's tracking link. */
function fulfillmentDrop(
  f: LiquidFulfillmentData,
  lines: LiquidOrderData['lineItems'],
): Record<string, unknown> {
  const items = f.lines.flatMap((x) => {
    const line = lines.find((l) => l.id === x.lineId)
    if (!line) return []
    const lineItem = {
      id: numericId(line.id),
      title: line.title,
      variant_title: line.variantTitle,
      quantity: line.quantity,
      image: imageDrop(line.image),
      url: line.url,
    }
    return [{ quantity: x.quantity, line_item: lineItem }]
  })
  return {
    id: numericId(f.id),
    created_at: f.createdAt,
    tracking_company: f.trackingCompany,
    tracking_number: f.trackingNumber,
    tracking_numbers: f.trackingNumber ? [f.trackingNumber] : [],
    tracking_url: f.trackingUrl ?? '',
    tracking_urls: f.trackingUrl ? [f.trackingUrl] : [],
    item_count: items.reduce((n, i) => n + i.quantity, 0),
    fulfillment_line_items: items,
  }
}

/** Shopify's `order` (in `customer.orders`), linking to the shopper's own order page. */
export function orderDrop(o: LiquidOrderData): Record<string, unknown> {
  const url = `/account/orders/${o.number}`
  const financial = FINANCIAL_STATUS[o.paymentStatus] ?? 'pending'
  // One drop per consignment, shared by every line it carries (themes group lines by it).
  const fulfillments = new Map<string, Record<string, unknown>>()
  const fulfillmentFor = (f: LiquidFulfillmentData) => {
    const drop = fulfillments.get(f.id) ?? fulfillmentDrop(f, o.lineItems)
    fulfillments.set(f.id, drop)
    return drop
  }
  return {
    id: numericId(o.id),
    name: o.name,
    order_number: o.number,
    created_at: o.createdAt,
    cancelled: o.cancelled,
    cancelled_at: o.cancelledAt,
    cancel_reason: '',
    cancel_reason_label: '',
    customer_url: url,
    order_status_url: url,
    financial_status: financial,
    financial_status_label: FINANCIAL_LABEL[financial] ?? '',
    fulfillment_status: FULFILLMENT_STATUS[o.fulfillmentStatus] ?? 'unfulfilled',
    fulfillment_status_label: FULFILLMENT_LABEL[o.fulfillmentStatus] ?? '',
    total_price: o.totalPrice,
    subtotal_price: o.subtotalPrice,
    line_items_subtotal_price: o.subtotalPrice,
    shipping_price: o.shippingPrice,
    item_count: o.lineItems.reduce((n, l) => n + l.quantity, 0),
    line_items: o.lineItems.map((l) => ({
      id: numericId(l.id),
      key: l.id,
      title: l.title,
      product_title: l.title,
      variant_title: l.variantTitle,
      variant: { title: l.variantTitle },
      quantity: l.quantity,
      price: l.price,
      final_price: l.price,
      original_price: l.price,
      line_price: l.linePrice,
      final_line_price: l.linePrice,
      original_line_price: l.linePrice,
      image: imageDrop(l.image),
      url: l.url,
      fulfillment: l.fulfillment ? fulfillmentFor(l.fulfillment) : null,
    })),
  }
}

/**
 * Shopify's `customer` object for the signed-in shopper, or nil. Money in hundredths, like every
 * price here. `orders` loads the first time a render reads it (`cache.customerOrders`), so a page
 * that never lists orders never queries them; the address book is left out (themes link to the
 * account pages for it).
 */
export function customerDrop(
  c: LiquidCustomerData | null,
  cache: LiquidDataCache,
): Record<string, unknown> | null {
  if (!c) return null
  const { first, last } = splitName(c.name)
  const a = c.defaultAddress
  const addressName = a ? splitName(a.name) : null
  let orders: { from: LiquidOrderData[]; drops: Record<string, unknown>[] } | null = null
  return {
    id: numericId(c.id),
    email: c.email ?? '',
    first_name: first,
    last_name: last,
    name: c.name?.trim() || c.email || c.phone || '',
    phone: c.phone,
    orders_count: c.ordersCount,
    total_spent: c.totalSpent,
    tags: c.tags,
    accepts_marketing: c.acceptsMarketing,
    has_account: true,
    addresses_count: c.addressesCount,
    default_address: a
      ? {
          name: a.name,
          first_name: addressName?.first ?? '',
          last_name: addressName?.last ?? '',
          address1: a.line1,
          address2: a.line2 ?? '',
          street: [a.line1, a.line2].filter(Boolean).join(', '),
          city: a.city,
          province_code: a.stateCode,
          zip: a.pincode,
          country_code: a.country,
          company: '',
          phone: '',
        }
      : null,
    // Reads empty while loading; the render runs again once it has loaded (`render.ts`).
    get orders(): Record<string, unknown>[] {
      const list = cache.customerOrders()
      if (!list) return []
      if (orders?.from !== list) orders = { from: list, drops: list.map(orderDrop) }
      return orders.drops
    },
  }
}
