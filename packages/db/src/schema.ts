import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'

export const newId = (): string => uuidv7()

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

export const store = pgTable('store', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  /** Better Auth organization that owns this store. One org = one store. */
  organizationId: text('organization_id').unique(),
  currency: text('currency').notNull().default('INR'),
  nextOrderNumber: integer('next_order_number').notNull().default(1),
  /** Theme tokens, validated by @commerce/core ThemeSchema. Null = platform default. */
  theme: jsonb('theme'),
  /** Payment settings: enabled methods and encrypted gateway credentials. */
  payments: jsonb('payments'),
  /** Notification settings: enabled channels and encrypted channel credentials. */
  notifications: jsonb('notifications'),
  /** Shipping settings: enabled couriers, encrypted credentials and the dispatch policy. */
  shipping: jsonb('shipping'),
  /** Enabled storage provider and its (encrypted) credentials; see core media settings. */
  storage: jsonb('storage'),
  /** Installed plugins: { installed: string[] }. Validated by @commerce/core AppsSettingsSchema. */
  apps: jsonb('apps'),
  /** Store details shown to shoppers and on invoices. Validated by @commerce/core StoreGeneralSchema. */
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  /** { line1, line2, city, state, pincode, country } */
  address: jsonb('address'),
  gstin: text('gstin'),
  /** GST rate contained in listed prices, as a percentage. */
  gstRatePercent: integer('gst_rate_percent').notNull().default(18),
  timezone: text('timezone').notNull().default('Asia/Kolkata'),
  createdAt: createdAt(),
})

export const product = pgTable('product', {
  id: id(),
  storeId: storeId(),
  handle: text('handle').notNull(),
  title: text('title').notNull(),
  /** Lexical JSON (see @commerce/richtext). Legacy rows hold a plain string; parseRichText copes. */
  description: jsonb('description'),
  vendor: text('vendor'),
  productType: text('product_type'),
  tags: text('tags').array().notNull().default([]),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  status: text('status', { enum: ['draft', 'active', 'archived'] })
    .notNull()
    .default('draft'),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Structured options: Colour / Size. A variant is one combination of values. */
export const productOption = pgTable('product_option', {
  id: id(),
  storeId: storeId(),
  productId: uuid('product_id')
    .notNull()
    .references(() => product.id),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
})

export const productOptionValue = pgTable('product_option_value', {
  id: id(),
  storeId: storeId(),
  optionId: uuid('option_id')
    .notNull()
    .references(() => productOption.id),
  value: text('value').notNull(),
  position: integer('position').notNull().default(0),
})

/**
 * Uploaded once, referenced anywhere (products, variants, pages). Rows are
 * created `pending` when the browser asks for a presigned upload and become
 * `ready` on confirm; a nightly sweep can drop stale pending rows. `key` is
 * null for imported catalogue images that live on someone else's CDN.
 */
export const media = pgTable('media', {
  id: id(),
  storeId: storeId(),
  url: text('url').notNull(),
  /** Object key in the storage provider; see @commerce/storage mediaKey. */
  key: text('key'),
  /** Which provider holds the object, so deletes go to the right bucket. */
  provider: text('provider'),
  contentType: text('content_type'),
  /** Bytes as declared at presign time. */
  size: integer('size'),
  alt: text('alt'),
  width: integer('width'),
  height: integer('height'),
  status: text('status', { enum: ['pending', 'ready'] })
    .notNull()
    .default('ready'),
  createdAt: createdAt(),
})

export const productMedia = pgTable('product_media', {
  id: id(),
  storeId: storeId(),
  productId: uuid('product_id')
    .notNull()
    .references(() => product.id),
  mediaId: uuid('media_id')
    .notNull()
    .references(() => media.id),
  position: integer('position').notNull().default(0),
})

export const variant = pgTable('variant', {
  id: id(),
  storeId: storeId(),
  productId: uuid('product_id')
    .notNull()
    .references(() => product.id),
  sku: text('sku'),
  barcode: text('barcode'),
  title: text('title').notNull(),
  pricePaise: integer('price_paise').notNull(),
  mrpPaise: integer('mrp_paise'),
  /** What the merchant paid; never shown to shoppers. */
  costPaise: integer('cost_paise'),
  taxable: boolean('taxable').notNull().default(true),
  /** false = always purchasable regardless of inventory_level. */
  trackInventory: boolean('track_inventory').notNull().default(true),
  weightGrams: integer('weight_grams'),
  position: integer('position').notNull().default(0),
  mediaId: uuid('media_id').references(() => media.id),
  /**
   * Variants referenced by order lines are never deleted; removing one from
   * the matrix archives it so old orders keep their titles and prices.
   */
  archivedAt: timestamp('archived_at', { withTimezone: true }),
})

export const variantOptionValue = pgTable('variant_option_value', {
  id: id(),
  storeId: storeId(),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => variant.id),
  optionValueId: uuid('option_value_id')
    .notNull()
    .references(() => productOptionValue.id),
})

export const inventoryLevel = pgTable('inventory_level', {
  id: id(),
  storeId: storeId(),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => variant.id)
    .unique(),
  onHand: integer('on_hand').notNull().default(0),
  reserved: integer('reserved').notNull().default(0),
})

/** Every change to on_hand, with why. Reconciles counts against the merchant's memory. */
export const inventoryAdjustment = pgTable('inventory_adjustment', {
  id: id(),
  storeId: storeId(),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => variant.id),
  delta: integer('delta').notNull(),
  reason: text('reason', {
    enum: ['correction', 'received', 'damaged', 'returned', 'sold', 'other'],
  }).notNull(),
  note: text('note'),
  createdAt: createdAt(),
})

export type CustomerAddress = {
  name: string
  line1: string
  line2?: string | null
  city: string
  stateCode: string
  pincode: string
  country?: string
  phone?: string | null
}

/** One row per shopper per store, keyed by lower-cased email; orders link to it. */
export const customer = pgTable(
  'customer',
  {
    id: id(),
    storeId: storeId(),
    email: text('email'),
    phone: text('phone'),
    name: text('name'),
    /** Snapshot of the address from the latest order, so the profile card needs no join. */
    defaultAddress: jsonb('default_address').$type<CustomerAddress>(),
    tags: text('tags').array().notNull().default([]),
    note: text('note'),
    acceptsMarketing: boolean('accepts_marketing').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customer_store_email').on(t.storeId, t.email)],
)

/** One address table, reused by customers and orders. state_code drives CGST/SGST vs IGST. */
export const address = pgTable('address', {
  id: id(),
  storeId: storeId(),
  name: text('name').notNull(),
  line1: text('line1').notNull(),
  line2: text('line2'),
  city: text('city').notNull(),
  stateCode: text('state_code').notNull(),
  pincode: text('pincode').notNull(),
  country: text('country').notNull().default('IN'),
  phone: text('phone').notNull(),
})

export const cart = pgTable('cart', {
  id: id(),
  storeId: storeId(),
  customerId: uuid('customer_id').references(() => customer.id),
  status: text('status', { enum: ['open', 'converted', 'abandoned'] })
    .notNull()
    .default('open'),
  /** Code the shopper typed; re-validated at checkout, never trusted for the amount. */
  discountCode: text('discount_code'),
  createdAt: createdAt(),
})

export const cartLine = pgTable('cart_line', {
  id: id(),
  storeId: storeId(),
  cartId: uuid('cart_id')
    .notNull()
    .references(() => cart.id),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => variant.id),
  quantity: integer('quantity').notNull(),
  unitPricePaise: integer('unit_price_paise').notNull(),
})

export const order = pgTable('order', {
  id: id(),
  storeId: storeId(),
  number: integer('number').notNull(),
  customerId: uuid('customer_id').references(() => customer.id),
  email: text('email'),
  phone: text('phone'),
  shippingAddressId: uuid('shipping_address_id').references(() => address.id),
  paymentMethod: text('payment_method'),
  status: text('status', { enum: ['placed', 'paid', 'fulfilled', 'delivered', 'cancelled'] })
    .notNull()
    .default('placed'),
  subtotalPaise: integer('subtotal_paise').notNull(),
  shippingPaise: integer('shipping_paise').notNull().default(0),
  /** Fee (+) or discount (−) for the chosen payment method, already inside total_paise. */
  paymentAdjustmentPaise: integer('payment_adjustment_paise').notNull().default(0),
  paymentAdjustmentLabel: text('payment_adjustment_label'),
  /** Code or automatic discount taken off the subtotal, already inside total_paise. */
  discountId: uuid('discount_id'),
  discountCode: text('discount_code'),
  discountLabel: text('discount_label'),
  discountPaise: integer('discount_paise').notNull().default(0),
  totalPaise: integer('total_paise').notNull(),
  /** GST already contained in total_paise (Indian prices are tax inclusive). */
  taxPaise: integer('tax_paise').notNull().default(0),
  /** GstBreakdown snapshot: rate, CGST/SGST or IGST, as charged. */
  taxBreakdown: jsonb('tax_breakdown'),
  tags: text('tags').array().notNull().default([]),
  placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
})

export const orderLine = pgTable('order_line', {
  id: id(),
  storeId: storeId(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => order.id),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => variant.id),
  /** Snapshots so a later rename or price change never rewrites history. */
  title: text('title'),
  variantTitle: text('variant_title'),
  quantity: integer('quantity').notNull(),
  unitPricePaise: integer('unit_price_paise').notNull(),
  /** How many of `quantity` have been packed; below it the line is unfulfilled. */
  fulfilledQuantity: integer('fulfilled_quantity').notNull().default(0),
})

export const payment = pgTable(
  'payment',
  {
    id: id(),
    storeId: storeId(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id),
    provider: text('provider').notNull(),
    providerRef: text('provider_ref').notNull(),
    /** Gateway's own payment id once known (Razorpay pay_..., etc). */
    providerPaymentId: text('provider_payment_id'),
    /** CheckoutSession from the adapter, so the pay page can open the gateway after a redirect. */
    checkoutSession: jsonb('checkout_session'),
    status: text('status', { enum: ['pending', 'captured', 'refunded', 'failed'] }).notNull(),
    amountPaise: integer('amount_paise').notNull(),
  },
  (t) => [
    check(
      'payment_status_check',
      sql`${t.status} in ('pending', 'captured', 'refunded', 'failed')`,
    ),
  ],
)

/**
 * Money returned to the shopper. Gateways process it themselves; COD and
 * manual transfers are settled outside the platform and recorded as `manual`.
 */
export const refund = pgTable('refund', {
  id: id(),
  storeId: storeId(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => order.id),
  paymentId: uuid('payment_id')
    .notNull()
    .references(() => payment.id),
  amountPaise: integer('amount_paise').notNull(),
  reason: text('reason'),
  status: text('status', { enum: ['pending', 'processed', 'failed', 'manual'] }).notNull(),
  providerRefundId: text('provider_refund_id'),
  createdAt: createdAt(),
})

/** Staff notes on an order; the timeline shows them beside system events. */
export const orderNote = pgTable('order_note', {
  id: id(),
  storeId: storeId(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => order.id),
  body: text('body').notNull(),
  /** Email of the staff member who wrote it. */
  author: text('author'),
  createdAt: createdAt(),
})

/** Every gateway webhook, stored before it is processed so retries cannot double-apply. */
export const paymentEvent = pgTable(
  'payment_event',
  {
    id: id(),
    storeId: storeId(),
    provider: text('provider').notNull(),
    eventId: text('event_id').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status', { enum: ['pending', 'processed', 'failed'] })
      .notNull()
      .default('pending'),
    error: text('error'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('payment_event_provider_event').on(t.storeId, t.provider, t.eventId)],
)

/** One row per message attempted, so admin can see what a shopper was told and retries never double-send. */
export const notification = pgTable(
  'notification',
  {
    id: id(),
    storeId: storeId(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id),
    channel: text('channel').notNull(),
    template: text('template').notNull(),
    /** Email address or phone the message went to. */
    to: text('to').notNull(),
    status: text('status', { enum: ['queued', 'sent', 'failed'] })
      .notNull()
      .default('queued'),
    providerRef: text('provider_ref'),
    error: text('error'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('notification_order_channel_template').on(t.orderId, t.channel, t.template)],
)

/** One courier consignment per order. Tracking is the courier's normalised answer, refreshed by the worker. */
export const shipment = pgTable(
  'shipment',
  {
    id: id(),
    storeId: storeId(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id),
    provider: text('provider').notNull(),
    waybill: text('waybill').notNull(),
    status: text('status', {
      enum: [
        'created',
        'picked_up',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'rto',
        'cancelled',
      ],
    })
      .notNull()
      .default('created'),
    labelUrl: text('label_url'),
    trackingUrl: text('tracking_url'),
    /** Last Tracking payload from the provider. */
    tracking: jsonb('tracking'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('shipment_provider_waybill').on(t.provider, t.waybill)],
)

export type DiscountKind = 'code' | 'automatic'
export type DiscountMethod = 'percent' | 'fixed' | 'free_shipping'
export type DiscountAppliesTo = 'all' | 'products' | 'collections'
export type DiscountStatus = 'active' | 'disabled'

/**
 * A discount code or an automatic offer. `value` is basis points for
 * `percent` and paise for `fixed`; free shipping has no value. Windows and
 * usage limits are optional; `used_count` is bumped in the order transaction.
 */
export const discount = pgTable(
  'discount',
  {
    id: id(),
    storeId: storeId(),
    title: text('title').notNull(),
    kind: text('kind').$type<DiscountKind>().notNull().default('code'),
    /** Upper-cased and trimmed; null for automatic discounts. */
    code: text('code'),
    method: text('method').$type<DiscountMethod>().notNull(),
    value: integer('value').notNull().default(0),
    minSubtotalPaise: integer('min_subtotal_paise'),
    appliesTo: text('applies_to').$type<DiscountAppliesTo>().notNull().default('all'),
    /** Product or collection ids when applies_to narrows the scope. */
    appliesToIds: jsonb('applies_to_ids').$type<string[]>().notNull().default([]),
    usageLimit: integer('usage_limit'),
    usagePerCustomer: integer('usage_per_customer'),
    usedCount: integer('used_count').notNull().default(0),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    status: text('status').$type<DiscountStatus>().notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('discount_store_code').on(t.storeId, t.code)],
)

/** One row per order that used a discount; drives usage limits and per-customer caps. */
export const discountUsage = pgTable('discount_usage', {
  id: id(),
  storeId: storeId(),
  discountId: uuid('discount_id')
    .notNull()
    .references(() => discount.id),
  orderId: uuid('order_id')
    .notNull()
    .references(() => order.id),
  customerId: uuid('customer_id').references(() => customer.id),
  email: text('email'),
  amountPaise: integer('amount_paise').notNull(),
  createdAt: createdAt(),
})

export const storeDomain = pgTable('store_domain', {
  id: id(),
  storeId: storeId(),
  hostname: text('hostname').notNull().unique(),
  isPrimary: boolean('is_primary').notNull().default(false),
})

/** Builder pages. `data` is the draft (Puck JSON); `publishedData` is what the storefront renders. */
export const page = pgTable(
  'page',
  {
    id: id(),
    storeId: storeId(),
    handle: text('handle').notNull(),
    title: text('title').notNull(),
    data: jsonb('data').notNull(),
    publishedData: jsonb('published_data'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('page_store_handle').on(t.storeId, t.handle)],
)
