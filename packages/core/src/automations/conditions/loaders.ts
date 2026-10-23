/** SOURCE OF TRUTH: automation subject loaders — WHAT: read the fresh data a run's conditions and merge tags see for its order, customer, product or cart (exactly the `condition-fields.ts` paths, money in paise, dates as ISO strings, plus ids and a few merge-tag names) inside the run's store transaction / WHY: a condition after a wait must judge the record as it is now, and the dry run and the worker must read it the same way. Server-only. Design §8.2, §8.5. */
import {
  address,
  cart,
  cartLine,
  collection,
  collectionProduct,
  customer,
  fulfillmentOrder,
  inventoryLevel,
  order,
  orderLine,
  product,
  type StoreTx,
  store,
  variant,
} from '@commerce/db'
import { and, eq, isNotNull, isNull, notInArray, or, sql } from 'drizzle-orm'
import { hasMarketingConsent } from '../../privacy/client'
import { INDIAN_STATE_NAMES } from '../../tax/states'
import type { RunSubject, SubjectData, SubjectLoader } from '../executor'

const stateName = (code: string | null | undefined): string =>
  code ? (INDIAN_STATE_NAMES[code.toUpperCase()] ?? code) : ''

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null)

const firstNameOf = (name: string | null | undefined): string => name?.trim().split(/\s+/)[0] ?? ''

/** Orders that count towards a customer's history: placed, not cancelled, real money. */
const COUNTED = and(notInArray(order.status, ['draft', 'cancelled']), eq(order.isTest, false))

/** `{order,cart}.customer.*` and `customer.*`: the condition fields plus name/email for merge tags. */
async function customerData(
  tx: StoreTx,
  customerId: string | null,
): Promise<Record<string, unknown> | null> {
  if (!customerId) return null
  const [c] = await tx.select().from(customer).where(eq(customer.id, customerId))
  if (!c) return null
  const [stats] = await tx
    .select({
      count: sql<number>`count(*)::int`,
      spent: sql<number>`coalesce(sum(${order.totalPaise}), 0)::bigint`,
    })
    .from(order)
    .where(and(eq(order.customerId, customerId), COUNTED))
  const orderCount = Number(stats?.count ?? 0)
  return {
    id: c.id,
    name: c.name ?? '',
    first_name: firstNameOf(c.name),
    email: c.email ?? '',
    tags: c.tags,
    order_count: orderCount,
    total_spent: Number(stats?.spent ?? 0),
    has_ordered: orderCount > 0,
    email_consent: hasMarketingConsent(c, 'email'),
    whatsapp_consent: hasMarketingConsent(c, 'whatsapp'),
    accepts_marketing: c.acceptsMarketing,
    state: stateName(c.defaultAddress?.stateCode),
    created_at: iso(c.createdAt),
  }
}

/** Payment words of the condition picker (`financial_status`) from the stored payment status. */
function financialStatus(o: typeof order.$inferSelect): string {
  switch (o.paymentStatus) {
    case 'paid':
    case 'partially_paid':
    case 'partially_refunded':
    case 'refunded':
      return o.paymentStatus
    case 'refund_needed':
      return 'paid'
    default:
      return o.status === 'cancelled' ? 'voided' : 'pending'
  }
}

const FULFILLED = new Set(['fulfilled', 'shipped', 'partially_delivered', 'delivered', 'returned'])

/** Fulfilment words of the picker; a held (or pre-order waiting) parcel of an unfinished order reads `on_hold`. */
async function fulfillmentStatus(tx: StoreTx, o: typeof order.$inferSelect): Promise<string> {
  if (FULFILLED.has(o.fulfillmentStatus)) return 'fulfilled'
  const [held] = await tx
    .select({ id: fulfillmentOrder.id })
    .from(fulfillmentOrder)
    .where(
      and(
        eq(fulfillmentOrder.orderId, o.id),
        or(eq(fulfillmentOrder.status, 'on_hold'), isNotNull(fulfillmentOrder.heldAt)),
      ),
    )
    .limit(1)
  if (held) return 'on_hold'
  return o.fulfillmentStatus === 'partially_fulfilled' ? 'partially_fulfilled' : 'unfulfilled'
}

async function orderData(tx: StoreTx, id: string): Promise<SubjectData | null> {
  const [o] = await tx.select().from(order).where(eq(order.id, id))
  if (!o) return null
  const [ship] = o.shippingAddressId
    ? await tx.select().from(address).where(eq(address.id, o.shippingAddressId))
    : []
  const lines = await tx
    .select({
      title: orderLine.title,
      productTitle: product.title,
      sku: variant.sku,
      quantity: orderLine.quantity,
      price: orderLine.unitPricePaise,
      tags: product.tags,
      type: product.productType,
    })
    .from(orderLine)
    .leftJoin(variant, eq(variant.id, orderLine.variantId))
    .leftJoin(product, eq(product.id, variant.productId))
    .where(eq(orderLine.orderId, id))
  return {
    order: {
      id: o.id,
      number: String(o.number),
      email: o.email ?? '',
      total: o.totalPaise,
      subtotal: o.subtotalPaise,
      discount_total: o.discountPaise,
      discount_codes: o.discountCode ? [o.discountCode] : [],
      payment_method: o.paymentMethod ?? '',
      is_cod: o.paymentMethod === 'cod',
      financial_status: financialStatus(o),
      fulfillment_status: await fulfillmentStatus(tx, o),
      shipping_state: stateName(ship?.stateCode),
      shipping_city: ship?.city ?? '',
      shipping_pincode: ship?.pincode ?? '',
      tags: o.tags,
      channel: o.importedFrom ?? 'online_store',
      item_count: lines.reduce((n, l) => n + l.quantity, 0),
      created_at: iso(o.placedAt),
      line_items: lines.map((l) => ({
        product_title: l.productTitle ?? l.title ?? '',
        sku: l.sku ?? '',
        quantity: l.quantity,
        price: l.price,
        product_tags: l.tags ?? [],
        product_type: l.type ?? '',
      })),
      customer: await customerData(tx, o.customerId),
    },
  }
}

async function productData(tx: StoreTx, id: string): Promise<SubjectData | null> {
  const [p] = await tx.select().from(product).where(eq(product.id, id))
  if (!p) return null
  const live = and(eq(variant.productId, id), isNull(variant.archivedAt))
  const [price] = await tx
    .select({ min: sql<number | null>`min(${variant.pricePaise})` })
    .from(variant)
    .where(live)
  // Available units the storefront sells: on hand less reserved, at selling locations.
  const [stock] = await tx
    .select({
      n: sql<number>`coalesce(sum(${inventoryLevel.onHand} - ${inventoryLevel.reserved}), 0)::int`,
    })
    .from(inventoryLevel)
    .innerJoin(variant, eq(variant.id, inventoryLevel.variantId))
    .where(and(live, eq(inventoryLevel.fulfilsOnline, true)))
  const collections = await tx
    .select({ title: collection.title })
    .from(collectionProduct)
    .innerJoin(collection, eq(collection.id, collectionProduct.collectionId))
    .where(eq(collectionProduct.productId, id))
  return {
    product: {
      id: p.id,
      title: p.title,
      handle: p.handle,
      status: p.status,
      tags: p.tags,
      type: p.productType ?? '',
      vendor: p.vendor ?? '',
      price: price?.min === null || price?.min === undefined ? null : Number(price.min),
      total_stock: Number(stock?.n ?? 0),
      collections: collections.map((c) => c.title),
    },
  }
}

async function cartData(tx: StoreTx, id: string): Promise<SubjectData | null> {
  const [c] = await tx.select().from(cart).where(eq(cart.id, id))
  if (!c) return null
  const [totals] = await tx
    .select({
      total: sql<number>`coalesce(sum(${cartLine.quantity} * ${cartLine.unitPricePaise}), 0)::int`,
      items: sql<number>`coalesce(sum(${cartLine.quantity}), 0)::int`,
    })
    .from(cartLine)
    .where(eq(cartLine.cartId, id))
  return {
    cart: {
      id: c.id,
      email: c.email ?? '',
      name: c.customerName ?? '',
      first_name: firstNameOf(c.customerName),
      total: Number(totals?.total ?? 0),
      item_count: Number(totals?.items ?? 0),
      customer: await customerData(tx, c.customerId),
    },
  }
}

const LOADERS: Record<string, (tx: StoreTx, id: string) => Promise<SubjectData | null>> = {
  order: orderData,
  customer: async (tx, id) => {
    const c = await customerData(tx, id)
    return c ? { customer: c } : null
  },
  product: productData,
  cart: cartData,
}

/** The store's name and time zone: `{store.name}` merge tags and calendar-date conditions. */
async function storeData(tx: StoreTx, storeId: string): Promise<Record<string, unknown>> {
  const [s] = await tx
    .select({ name: store.name, timezone: store.timezone })
    .from(store)
    .where(eq(store.id, storeId))
  return { name: s?.name ?? '', timezone: s?.timezone ?? 'Asia/Kolkata' }
}

/**
 * Loads a run's subject (`{ order }`, `{ customer }`, `{ product }`, `{ cart }`, plus `store`);
 * null when the record is gone. Subject-free and plugin subjects get the store alone.
 */
export const loadSubject: SubjectLoader = async (
  tx: StoreTx,
  storeId: string,
  subject: RunSubject,
) => {
  const load = LOADERS[subject.type]
  const data = load && subject.id ? await load(tx, subject.id) : {}
  if (!data) return null
  return { ...data, store: await storeData(tx, storeId) }
}

/** Customer ids behind records, for actions that reach the customer of an order or cart. */
export async function customerIdOf(tx: StoreTx, subject: RunSubject): Promise<string | null> {
  if (!subject.id) return null
  if (subject.type === 'customer') return subject.id
  if (subject.type === 'order') {
    const [o] = await tx
      .select({ id: order.customerId })
      .from(order)
      .where(eq(order.id, subject.id))
    return o?.id ?? null
  }
  if (subject.type === 'cart') {
    const [c] = await tx.select({ id: cart.customerId }).from(cart).where(eq(cart.id, subject.id))
    return c?.id ?? null
  }
  return null
}
