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
  createdAt: createdAt(),
})

export const product = pgTable('product', {
  id: id(),
  storeId: storeId(),
  handle: text('handle').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  vendor: text('vendor'),
  productType: text('product_type'),
  status: text('status', { enum: ['draft', 'active', 'archived'] })
    .notNull()
    .default('draft'),
  createdAt: createdAt(),
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

/** Uploaded once, referenced anywhere. `url` is external until R2 upload lands, then r2Key fills. */
export const media = pgTable('media', {
  id: id(),
  storeId: storeId(),
  url: text('url').notNull(),
  r2Key: text('r2_key'),
  alt: text('alt'),
  width: integer('width'),
  height: integer('height'),
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
  title: text('title').notNull(),
  pricePaise: integer('price_paise').notNull(),
  mrpPaise: integer('mrp_paise'),
  position: integer('position').notNull().default(0),
  mediaId: uuid('media_id').references(() => media.id),
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

export const customer = pgTable('customer', {
  id: id(),
  storeId: storeId(),
  email: text('email'),
  phone: text('phone'),
  name: text('name'),
})

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
  totalPaise: integer('total_paise').notNull(),
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
