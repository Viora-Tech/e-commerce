import { eq, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { invitation } from './auth-schema'

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
  /**
   * Legacy theme tokens, validated by @commerce/core ThemeSchema. Superseded by the
   * `theme` table (the store's main theme); still read as a fallback for stores that
   * have no theme row yet, and no longer written.
   */
  theme: jsonb('theme'),
  /** Online Store preferences: SEO defaults, password page, privacy banner, tracking ids. Validated by @commerce/core StorePreferencesSchema. */
  preferences: jsonb('preferences'),
  /** Which menus the storefront renders, by handle. Validated by @commerce/core NavigationSettingsSchema. */
  navigation: jsonb('navigation'),
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
  /** Variants at or below this available count show as low stock. */
  lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
  /** Gift card settings (default expiry for sold cards). Validated by @commerce/core GiftCardSettingsSchema. */
  giftCards: jsonb('gift_cards'),
  createdAt: createdAt(),
})

export const product = pgTable('product', {
  id: id(),
  storeId: storeId(),
  handle: text('handle').notNull(),
  title: text('title').notNull(),
  /** Alternate product template (`product.<suffix>`); null uses the default. */
  templateSuffix: text('template_suffix'),
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
  /** Prices already carry tax; the GST split is extracted rather than added at checkout. */
  taxIncluded: boolean('tax_included').notNull().default(true),
  /** Shown in the storefront's featured section. */
  featured: boolean('featured').notNull().default(false),
  /** Sold as a gift card: digital, never shipped or taxed at sale; paid lines issue a card by email. */
  isGiftCard: boolean('is_gift_card').notNull().default(false),
  /** Optional window for the compare-at price; outside it the storefront shows the plain price. */
  saleStartsAt: timestamp('sale_starts_at', { withTimezone: true }),
  saleEndsAt: timestamp('sale_ends_at', { withTimezone: true }),
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

/** Rule fields an automatic collection can match on; the evaluator lives in @commerce/core/collections. */
export type CollectionField = 'title' | 'type' | 'vendor' | 'tag' | 'price'
export type CollectionOp = 'eq' | 'neq' | 'contains' | 'starts_with' | 'gt' | 'lt'
export type CollectionCondition = { field: CollectionField; op: CollectionOp; value: string }
export type CollectionRules = { match: 'all' | 'any'; conditions: CollectionCondition[] }
export type CollectionSort =
  | 'manual'
  | 'title_asc'
  | 'title_desc'
  | 'price_asc'
  | 'price_desc'
  | 'created_desc'

/**
 * A group of products. `manual` collections list their members in
 * `collection_product`; `automatic` ones recompute that table from `rules`
 * whenever a product changes.
 */
export const collection = pgTable(
  'collection',
  {
    id: id(),
    storeId: storeId(),
    handle: text('handle').notNull(),
    title: text('title').notNull(),
    /** Lexical JSON, like product.description. */
    description: jsonb('description'),
    /** Alternate collection template (`collection.<suffix>`); null uses the default. */
    templateSuffix: text('template_suffix'),
    imageMediaId: uuid('image_media_id').references(() => media.id),
    kind: text('kind', { enum: ['manual', 'automatic'] })
      .notNull()
      .default('manual'),
    rules: jsonb('rules').$type<CollectionRules>().notNull().default({
      match: 'all',
      conditions: [],
    }),
    sortOrder: text('sort_order', {
      enum: ['manual', 'title_asc', 'title_desc', 'price_asc', 'price_desc', 'created_desc'],
    })
      .notNull()
      .default('manual'),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    status: text('status', { enum: ['draft', 'active'] })
      .notNull()
      .default('active'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('collection_store_handle').on(t.storeId, t.handle)],
)

/** Membership. Automatic collections rewrite these rows; manual ones own `position`. */
export const collectionProduct = pgTable(
  'collection_product',
  {
    id: id(),
    storeId: storeId(),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collection.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id),
    position: integer('position').notNull().default(0),
  },
  (t) => [uniqueIndex('collection_product_unique').on(t.collectionId, t.productId)],
)

/** A blog the storefront lists at `/blogs/<handle>`, Shopify-style. */
export const blog = pgTable(
  'blog',
  {
    id: id(),
    storeId: storeId(),
    title: text('title').notNull(),
    handle: text('handle').notNull(),
    commentPolicy: text('comment_policy', { enum: ['disabled', 'moderated', 'open'] })
      .notNull()
      .default('disabled'),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('blog_store_handle').on(t.storeId, t.handle)],
)

/**
 * One blog post. `status` is what the merchant chose; visibility on the
 * storefront is `published`, or `scheduled` once `published_at` has passed.
 */
export const article = pgTable(
  'article',
  {
    id: id(),
    storeId: storeId(),
    blogId: uuid('blog_id')
      .notNull()
      .references(() => blog.id),
    title: text('title').notNull(),
    handle: text('handle').notNull(),
    author: text('author').notNull().default(''),
    /** Lexical JSON, like product.description. */
    body: jsonb('body'),
    excerpt: text('excerpt'),
    imageMediaId: uuid('image_media_id').references(() => media.id),
    imageAlt: text('image_alt'),
    tags: text('tags').array().notNull().default([]),
    status: text('status', { enum: ['draft', 'scheduled', 'published'] })
      .notNull()
      .default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('article_blog_handle').on(t.blogId, t.handle),
    index('article_store_published').on(t.storeId, t.status, t.publishedAt),
  ],
)

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
  /** Customs fields printed on international labels and invoices. */
  hsCode: text('hs_code'),
  countryOfOrigin: text('country_of_origin'),
  /** GST rate for this variant; null uses the store default. Ignored when `taxable` is false. */
  gstRatePercent: integer('gst_rate_percent'),
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

/**
 * Where stock physically sits. Every store has exactly one default location,
 * created with the store (or by the inventory_level insert trigger), and it is
 * the one that fulfils online orders.
 */
export const location = pgTable(
  'location',
  {
    id: id(),
    storeId: storeId(),
    name: text('name').notNull(),
    line1: text('line1'),
    line2: text('line2'),
    city: text('city'),
    stateCode: text('state_code'),
    pincode: text('pincode'),
    country: text('country').notNull().default('IN'),
    phone: text('phone'),
    isDefault: boolean('is_default').notNull().default(false),
    active: boolean('active').notNull().default(true),
    /** Stock here is what the storefront sells and orders reserve. */
    fulfilsOnlineOrders: boolean('fulfils_online_orders').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('location_one_default').on(t.storeId).where(sql`${t.isDefault}`)],
)

/**
 * Stock of one variant at one location. on_hand is physically there, reserved
 * (shown as Committed) is held by open orders, incoming is on purchase orders or
 * transfers not yet received. Available = on_hand - reserved.
 *
 * Exactly one row per variant has fulfils_online = true: the row the storefront,
 * carts and orders read. Filter on it with `sellableLevel` whenever joining on
 * variant_id alone.
 */
export const inventoryLevel = pgTable(
  'inventory_level',
  {
    id: id(),
    storeId: storeId(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => variant.id),
    /** Filled by trigger from the store's default location when omitted. */
    locationId: uuid('location_id').references(() => location.id),
    onHand: integer('on_hand').notNull().default(0),
    reserved: integer('reserved').notNull().default(0),
    incoming: integer('incoming').notNull().default(0),
    fulfilsOnline: boolean('fulfils_online').notNull().default(true),
  },
  (t) => [
    uniqueIndex('inventory_level_variant_location').on(t.variantId, t.locationId),
    uniqueIndex('inventory_level_one_sellable').on(t.variantId).where(sql`${t.fulfilsOnline}`),
  ],
)

/**
 * The one inventory row per variant that online selling reads. Add it to any
 * join or filter on inventory_level.variant_id alone, or rows at other
 * locations multiply the result.
 */
export const sellableLevel = eq(inventoryLevel.fulfilsOnline, true)

/** Every change to on_hand, with why. Reconciles counts against the merchant's memory. */
export const inventoryAdjustment = pgTable('inventory_adjustment', {
  id: id(),
  storeId: storeId(),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => variant.id),
  /** Null on rows written before locations existed; those were the default location. */
  locationId: uuid('location_id').references(() => location.id),
  delta: integer('delta').notNull(),
  reason: text('reason', {
    enum: ['correction', 'received', 'damaged', 'returned', 'theft', 'transfer', 'sold', 'other'],
  }).notNull(),
  note: text('note'),
  createdAt: createdAt(),
})

/** Stock ordered from a supplier into one location; receiving turns incoming into on_hand. */
export const purchaseOrder = pgTable(
  'purchase_order',
  {
    id: id(),
    storeId: storeId(),
    number: integer('number').notNull(),
    supplierName: text('supplier_name').notNull(),
    supplierEmail: text('supplier_email'),
    supplierPhone: text('supplier_phone'),
    locationId: uuid('location_id')
      .notNull()
      .references(() => location.id),
    status: text('status', {
      enum: ['draft', 'ordered', 'partially_received', 'received', 'closed'],
    })
      .notNull()
      .default('draft'),
    expectedAt: timestamp('expected_at', { withTimezone: true }),
    currency: text('currency').notNull().default('INR'),
    shippingPaise: integer('shipping_paise').notNull().default(0),
    taxPaise: integer('tax_paise').notNull().default(0),
    note: text('note'),
    orderedAt: timestamp('ordered_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('purchase_order_store_number').on(t.storeId, t.number)],
)

export const purchaseOrderLine = pgTable('purchase_order_line', {
  id: id(),
  storeId: storeId(),
  purchaseOrderId: uuid('purchase_order_id')
    .notNull()
    .references(() => purchaseOrder.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => variant.id),
  quantity: integer('quantity').notNull(),
  received: integer('received').notNull().default(0),
  unitCostPaise: integer('unit_cost_paise').notNull().default(0),
})

/** Stock moving between two locations: shipping moves it to incoming, receiving lands it. */
export const transfer = pgTable(
  'transfer',
  {
    id: id(),
    storeId: storeId(),
    number: integer('number').notNull(),
    fromLocationId: uuid('from_location_id')
      .notNull()
      .references(() => location.id),
    toLocationId: uuid('to_location_id')
      .notNull()
      .references(() => location.id),
    status: text('status', { enum: ['draft', 'in_transit', 'received'] })
      .notNull()
      .default('draft'),
    note: text('note'),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('transfer_store_number').on(t.storeId, t.number)],
)

export const transferLine = pgTable('transfer_line', {
  id: id(),
  storeId: storeId(),
  transferId: uuid('transfer_id')
    .notNull()
    .references(() => transfer.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => variant.id),
  quantity: integer('quantity').notNull(),
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
    /** Opted in to WhatsApp marketing (broadcasts and promotional automations). */
    acceptsWhatsapp: boolean('accepts_whatsapp').notNull().default(false),
    /** When and where the latest email consent was given, e.g. `newsletter`, `checkout`, `admin`. */
    marketingConsentAt: timestamp('marketing_consent_at', { withTimezone: true }),
    marketingConsentSource: text('marketing_consent_source'),
    /** Set by the unsubscribe link; no marketing email or automation reaches the customer after it. */
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customer_store_email').on(t.storeId, t.email)],
)

export type CustomerSegmentField =
  | 'spend'
  | 'orders'
  | 'state'
  | 'tag'
  | 'last_order_days'
  | 'marketing'
export type CustomerSegmentOp = 'gte' | 'lte' | 'eq' | 'neq' | 'contains'
export type CustomerSegmentCondition = {
  field: CustomerSegmentField
  op: CustomerSegmentOp
  value: string
}
export type CustomerSegmentRules = {
  match: 'all' | 'any'
  conditions: CustomerSegmentCondition[]
}

/** A saved customer filter: `rules` holds `{ match, conditions[] }` evaluated by core. */
export const customerSegment = pgTable(
  'customer_segment',
  {
    id: id(),
    storeId: storeId(),
    name: text('name').notNull(),
    rules: jsonb('rules').$type<CustomerSegmentRules>().notNull().default({
      match: 'all',
      conditions: [],
    }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customer_segment_store_name').on(t.storeId, t.name)],
)

/**
 * Where a visit came from. Captured by the storefront beacon at the start of a
 * session, kept last-non-direct in a cookie, stamped on carts and orders.
 */
export type MarketingAttribution = {
  channel: string
  source?: string | undefined
  medium?: string | undefined
  campaign?: string | undefined
  content?: string | undefined
  term?: string | undefined
  referrer?: string | undefined
  landing?: string | undefined
  /** Set when the visit came from one of our own marketing messages. */
  messageId?: string | undefined
  campaignId?: string | undefined
  automationId?: string | undefined
  /** ISO time of the touch. */
  at: string
}

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

/**
 * A shopper's saved address book (storefront account). Separate from `address`,
 * which holds immutable order snapshots. At most one default per customer.
 */
export const customerAddress = pgTable(
  'customer_address',
  {
    id: id(),
    storeId: storeId(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customer.id),
    name: text('name').notNull(),
    line1: text('line1').notNull(),
    line2: text('line2'),
    city: text('city').notNull(),
    stateCode: text('state_code').notNull(),
    pincode: text('pincode').notNull(),
    country: text('country').notNull().default('IN'),
    phone: text('phone').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('customer_address_customer').on(t.customerId),
    uniqueIndex('customer_address_one_default').on(t.customerId).where(sql`is_default`),
  ],
)

/**
 * Pending storefront sign-in code, one per email per store. Only a SHA-256 hash is
 * kept; `attempts` caps guessing. Separate from Better Auth's merchant tables.
 */
export const customerLoginCode = pgTable(
  'customer_login_code',
  {
    id: id(),
    storeId: storeId(),
    email: text('email').notNull(),
    codeHash: text('code_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('customer_login_code_store_email').on(t.storeId, t.email)],
)

/** A signed-in storefront shopper. The cookie holds the token; only its hash is stored. */
export const customerSession = pgTable(
  'customer_session',
  {
    id: id(),
    storeId: storeId(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customer.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('customer_session_token').on(t.tokenHash),
    index('customer_session_customer').on(t.customerId),
  ],
)

export const cart = pgTable('cart', {
  id: id(),
  storeId: storeId(),
  customerId: uuid('customer_id').references(() => customer.id),
  status: text('status', { enum: ['open', 'converted', 'abandoned'] })
    .notNull()
    .default('open'),
  /** Code the shopper typed; re-validated at checkout, never trusted for the amount. */
  discountCode: text('discount_code'),
  /** Contact captured at checkout before the order exists; what makes a cart recoverable. */
  email: text('email'),
  phone: text('phone'),
  customerName: text('customer_name'),
  /** Where the shopper came from (UTM, referrer, marketing click); copied onto the order. */
  attribution: jsonb('attribution').$type<MarketingAttribution>(),
  createdAt: createdAt(),
  /** Touched on every line or contact change; the abandoned window is measured from here. */
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  recoverySentAt: timestamp('recovery_sent_at', { withTimezone: true }),
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
  /** `draft` is a merchant-built order that has not been placed: no stock held, no revenue. */
  status: text('status', {
    enum: ['draft', 'placed', 'paid', 'fulfilled', 'delivered', 'cancelled'],
  })
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
  /** Snapshot of the cart's attribution when the order was placed; drives Marketing reports. */
  attribution: jsonb('attribution').$type<MarketingAttribution>(),
  placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
  /**
   * Set on historical orders brought over from another platform (`shopify`). Such
   * orders are read-only: they never reserve stock, notify, or run app hooks.
   */
  importedFrom: text('imported_from'),
  /** What the source platform said: its order name, financial and fulfilment status. */
  importMeta: jsonb('import_meta').$type<OrderImportMeta>(),
})

export type OrderImportMeta = {
  /** The source's order name, e.g. `#1001`. */
  name: string
  sourceId?: string | null
  financialStatus?: string | null
  fulfillmentStatus?: string | null
  paymentMethod?: string | null
  cancelledAt?: string | null
  refundedPaise?: number | null
}

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
  /** GST rate charged, 0 for exempt goods. Null on orders placed before rates were recorded. */
  gstRatePercent: integer('gst_rate_percent'),
  /** HSN code as it stood when the order was placed. */
  hsCode: text('hs_code'),
  /** A gift card sold on this line: a voucher, so it stays out of tax invoices and shipping. */
  giftCard: boolean('gift_card').notNull().default(false),
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
    /** Null for messages about a cart that never became an order (checkout recovery). */
    orderId: uuid('order_id').references(() => order.id),
    cartId: uuid('cart_id').references(() => cart.id),
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
  (t) => [
    uniqueIndex('notification_order_channel_template').on(t.orderId, t.channel, t.template),
    uniqueIndex('notification_cart_channel_template')
      .on(t.cartId, t.channel, t.template)
      .where(sql`cart_id is not null`),
  ],
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

export type DomainKind = 'platform' | 'custom'
export type DomainStatus = 'pending' | 'active' | 'failed'
export type DomainSslStatus = 'pending' | 'issuing' | 'active' | 'failed'

/**
 * Hostnames that serve a store. `platform` domains come with the store and
 * cannot be removed (the defaults describe them); `custom` ones are inserted
 * pending by the domains service, verified over DNS by the domain provider, and
 * only resolve once `status` is `active`.
 * A non-primary domain with `redirect_to_primary` answers with a 301 to the
 * primary one (www to apex, old domains).
 */
export const storeDomain = pgTable(
  'store_domain',
  {
    id: id(),
    storeId: storeId(),
    hostname: text('hostname').notNull().unique(),
    isPrimary: boolean('is_primary').notNull().default(false),
    kind: text('kind').$type<DomainKind>().notNull().default('platform'),
    status: text('status').$type<DomainStatus>().notNull().default('active'),
    sslStatus: text('ssl_status').$type<DomainSslStatus>().notNull().default('active'),
    redirectToPrimary: boolean('redirect_to_primary').notNull().default(false),
    /** TXT value proving ownership, published at `_waimers-verify.<hostname>`. */
    verificationToken: text('verification_token'),
    /** Last provider error, in words the merchant can act on. */
    error: text('error'),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('store_domain_one_primary').on(t.storeId).where(sql`is_primary`),
    check('store_domain_kind', sql`${t.kind} in ('platform', 'custom')`),
    check('store_domain_status', sql`${t.status} in ('pending', 'active', 'failed')`),
    check(
      'store_domain_ssl_status',
      sql`${t.sslStatus} in ('pending', 'issuing', 'active', 'failed')`,
    ),
  ],
)

export type GiftCardSource = 'manual' | 'purchase'
export type GiftCardTransactionKind = 'issue' | 'debit' | 'refund' | 'adjustment'

/**
 * A prepaid voucher. The code is never stored in the clear: `code_hash` is an
 * HMAC for lookup and `code_cipher` an AES-GCM copy used only to (re)send it to
 * the recipient; admin sees `last_characters`. `balance_paise` only moves with a
 * `gift_card_transaction` row written in the same transaction.
 */
export const giftCard = pgTable(
  'gift_card',
  {
    id: id(),
    storeId: storeId(),
    codeHash: text('code_hash').notNull(),
    codeCipher: text('code_cipher'),
    lastCharacters: text('last_characters').notNull(),
    initialValuePaise: integer('initial_value_paise').notNull(),
    balancePaise: integer('balance_paise').notNull(),
    currency: text('currency').notNull().default('INR'),
    /** Last day the card can be used, in the store's time zone. Null never expires. */
    expiresOn: date('expires_on', { mode: 'string' }),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    customerId: uuid('customer_id').references(() => customer.id),
    recipientEmail: text('recipient_email'),
    recipientName: text('recipient_name'),
    /** Message from the buyer, printed in the email. */
    message: text('message'),
    /** Staff-only note. */
    note: text('note'),
    source: text('source').$type<GiftCardSource>().notNull().default('manual'),
    /** The order and line that sold it; with `line_index` this makes issuing on payment idempotent. */
    orderId: uuid('order_id').references(() => order.id),
    orderLineId: uuid('order_line_id').references(() => orderLine.id),
    lineIndex: integer('line_index'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdBy: text('created_by'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('gift_card_store_code').on(t.storeId, t.codeHash),
    uniqueIndex('gift_card_order_line')
      .on(t.orderLineId, t.lineIndex)
      .where(sql`order_line_id is not null`),
    index('gift_card_customer').on(t.customerId),
    check('gift_card_balance', sql`${t.balancePaise} >= 0`),
    check('gift_card_initial', sql`${t.initialValuePaise} > 0`),
    check('gift_card_source', sql`${t.source} in ('manual', 'purchase')`),
  ],
)

/** Every balance movement, signed: issue and refund add, debit subtracts. */
export const giftCardTransaction = pgTable(
  'gift_card_transaction',
  {
    id: id(),
    storeId: storeId(),
    giftCardId: uuid('gift_card_id')
      .notNull()
      .references(() => giftCard.id),
    kind: text('kind').$type<GiftCardTransactionKind>().notNull(),
    amountPaise: integer('amount_paise').notNull(),
    balanceAfterPaise: integer('balance_after_paise').notNull(),
    orderId: uuid('order_id').references(() => order.id),
    paymentId: uuid('payment_id').references(() => payment.id),
    note: text('note'),
    author: text('author'),
    createdAt: createdAt(),
  },
  (t) => [
    index('gift_card_transaction_card').on(t.giftCardId),
    check(
      'gift_card_transaction_kind',
      sql`${t.kind} in ('issue', 'debit', 'refund', 'adjustment')`,
    ),
  ],
)

/** Value types shared by metaobject fields and product/collection metafields. */
export const METAFIELD_TYPES = [
  'single_line_text',
  'multi_line_text',
  'rich_text',
  'number_integer',
  'number_decimal',
  'boolean',
  'date',
  'url',
  'file',
  'product_reference',
  'collection_reference',
  'metaobject_reference',
] as const
export type MetafieldType = (typeof METAFIELD_TYPES)[number]

/** One field of a metaobject definition. Validated by @commerce/core metaobject schemas. */
export type MetaobjectFieldDefinition = {
  key: string
  name: string
  type: MetafieldType
  list: boolean
  required: boolean
  description?: string | undefined
  /** Type-specific rules: min/max, choices, max length, referenced definition id. */
  validations?: Record<string, unknown> | undefined
}

/** A custom content type (Shopify's metaobject definition); `type` is its handle. */
export const metaobjectDefinition = pgTable(
  'metaobject_definition',
  {
    id: id(),
    storeId: storeId(),
    type: text('type').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    /** Field key whose value names an entry in lists and pickers. */
    displayNameKey: text('display_name_key'),
    fields: jsonb('fields').$type<MetaobjectFieldDefinition[]>().notNull().default([]),
    /** Readable by the storefront data layer. */
    storefrontAccess: boolean('storefront_access').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('metaobject_definition_store_type').on(t.storeId, t.type),
    check('metaobject_definition_type', sql`${t.type} ~ '^[a-z][a-z0-9_]{0,63}$'`),
  ],
)

/** One entry of a metaobject definition; `fields` maps field key to its typed value. */
export const metaobject = pgTable(
  'metaobject',
  {
    id: id(),
    storeId: storeId(),
    definitionId: uuid('definition_id')
      .notNull()
      .references(() => metaobjectDefinition.id, { onDelete: 'cascade' }),
    handle: text('handle').notNull(),
    fields: jsonb('fields').$type<Record<string, unknown>>().notNull().default({}),
    status: text('status', { enum: ['draft', 'active'] })
      .notNull()
      .default('active'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('metaobject_definition_handle').on(t.definitionId, t.handle),
    index('metaobject_store').on(t.storeId),
  ],
)

export type MetafieldOwnerType = 'product' | 'collection'

/** A typed custom field on products or collections (`namespace.key`). */
export const metafieldDefinition = pgTable(
  'metafield_definition',
  {
    id: id(),
    storeId: storeId(),
    ownerType: text('owner_type').$type<MetafieldOwnerType>().notNull(),
    namespace: text('namespace').notNull().default('custom'),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    type: text('type').$type<MetafieldType>().notNull(),
    list: boolean('list').notNull().default(false),
    validations: jsonb('validations').$type<Record<string, unknown>>().notNull().default({}),
    storefrontAccess: boolean('storefront_access').notNull().default(true),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('metafield_definition_owner_key').on(t.storeId, t.ownerType, t.namespace, t.key),
    check('metafield_definition_owner', sql`${t.ownerType} in ('product', 'collection')`),
    check('metafield_definition_key', sql`${t.key} ~ '^[a-z][a-z0-9_]{0,63}$'`),
    check('metafield_definition_namespace', sql`${t.namespace} ~ '^[a-z][a-z0-9_]{0,63}$'`),
  ],
)

/** The value of one definition on one product or collection. */
export const metafield = pgTable(
  'metafield',
  {
    id: id(),
    storeId: storeId(),
    definitionId: uuid('definition_id')
      .notNull()
      .references(() => metafieldDefinition.id, { onDelete: 'cascade' }),
    ownerType: text('owner_type').$type<MetafieldOwnerType>().notNull(),
    ownerId: uuid('owner_id').notNull(),
    value: jsonb('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('metafield_definition_owner').on(t.definitionId, t.ownerId),
    index('metafield_owner').on(t.ownerType, t.ownerId),
  ],
)

/**
 * A 301 from an old storefront path to a new destination, Shopify style. `path`
 * is normalised (lowercase, leading slash, no trailing slash, no query) so the
 * storefront can look it up by equality; `target` is a path or an absolute URL.
 */
export const urlRedirect = pgTable(
  'url_redirect',
  {
    id: id(),
    storeId: storeId(),
    path: text('path').notNull(),
    target: text('target').notNull(),
    /** `import` rows came from a store migration; the merchant can edit either. */
    source: text('source', { enum: ['manual', 'import'] })
      .notNull()
      .default('manual'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('url_redirect_store_path').on(t.storeId, t.path)],
)

/** Builder pages. `data` is the draft (Puck JSON); `publishedData` is what the storefront renders. */
export const page = pgTable(
  'page',
  {
    id: id(),
    storeId: storeId(),
    handle: text('handle').notNull(),
    title: text('title').notNull(),
    /** Page content (Lexical JSON), rendered by the template's Main page section. */
    body: jsonb('body'),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    /** Alternate page template (`page.<suffix>`); null uses the default page template. */
    templateSuffix: text('template_suffix'),
    /** Legacy Puck layout from before theme templates; kept read-only for rollback. */
    data: jsonb('data').notNull(),
    publishedData: jsonb('published_data'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('page_store_handle').on(t.storeId, t.handle)],
)

export type NavigationItemType = 'home' | 'product' | 'collection' | 'page' | 'url'

/** One entry in a storefront menu, kept in order inside navigation_menu.items. */
export type NavigationItem = {
  id: string
  title: string
  type: NavigationItemType
  /** Handle for product/collection/page, the URL for url; absent for home. */
  value?: string | undefined
  /**
   * Nested items. A menu is at most three levels deep (top, dropdown, and the
   * grouped columns of a mega menu), the same ceiling Shopify sets.
   */
  children?: NavigationItem[] | undefined
}

/**
 * A store's themes, Shopify style: exactly one `main` theme is live on the
 * storefront; the rest are `unpublished` drafts in the theme library. `settings`
 * is the colours/typography/shape document validated by @commerce/core ThemeSchema.
 * Per-template section data (home, product, collection, page) belongs in its own
 * table keyed by theme id, not here.
 */
export const theme = pgTable(
  'theme',
  {
    id: id(),
    storeId: storeId(),
    name: text('name').notNull(),
    role: text('role').notNull().default('unpublished'),
    /** The preset it was created from; informational ("Based on Minimal"). */
    preset: text('preset'),
    settings: jsonb('settings').notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => [
    check('theme_role', sql`${t.role} in ('main','unpublished')`),
    uniqueIndex('theme_one_main_per_store').on(t.storeId).where(sql`role = 'main'`),
    index('theme_store').on(t.storeId),
  ],
)

/** Templates a theme renders, plus the two section groups every template shares. */
export const THEME_TEMPLATE_KINDS = [
  'home',
  'product',
  'collection',
  'page',
  'blog',
  'article',
  'cart',
  'search',
  'not_found',
  'header',
  'footer',
] as const
export type ThemeTemplateKind = (typeof THEME_TEMPLATE_KINDS)[number]

/**
 * One template of one theme, as Puck data (`content` is its ordered sections).
 * `suffix` names an alternate (`page.contact` is template `page`, suffix `contact`);
 * the empty string is the default. `draft` holds unsaved Customize edits: previews of
 * this theme render it, the storefront never does.
 */
export const themeTemplate = pgTable(
  'theme_template',
  {
    id: id(),
    storeId: storeId(),
    themeId: uuid('theme_id')
      .notNull()
      .references(() => theme.id, { onDelete: 'cascade' }),
    template: text('template').notNull(),
    suffix: text('suffix').notNull().default(''),
    sections: jsonb('sections').notNull(),
    draft: jsonb('draft'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'theme_template_kind',
      sql`${t.template} in ('home','product','collection','page','blog','article','cart','search','not_found','header','footer')`,
    ),
    check('theme_template_suffix', sql`${t.suffix} ~ '^[a-z0-9-]{0,40}$'`),
    uniqueIndex('theme_template_unique').on(t.themeId, t.template, t.suffix),
    index('theme_template_store').on(t.storeId),
  ],
)

/**
 * Storefront menus (header, footer). The storefront renders them later;
 * for now the admin owns the list and every item's destination.
 */
export const navigationMenu = pgTable(
  'navigation_menu',
  {
    id: id(),
    storeId: storeId(),
    title: text('title').notNull(),
    handle: text('handle').notNull(),
    items: jsonb('items').$type<NavigationItem[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('navigation_menu_store_handle').on(t.storeId, t.handle)],
)

/**
 * Store roles. `is_system` rows (owner, admin, staff) are seeded per store and
 * may not be renamed, re-permissioned or deleted from the admin.
 */
export const role = pgTable(
  'role',
  {
    id: id(),
    storeId: storeId(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('role_store_slug').on(t.storeId, t.slug)],
)

/** One row per granted permission, so "who can refund?" is a plain query. */
export const rolePermission = pgTable(
  'role_permission',
  {
    id: id(),
    storeId: storeId(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(),
  },
  (t) => [uniqueIndex('role_permission_role_permission').on(t.roleId, t.permission)],
)

/**
 * Authorisation record for a member of this store. Better Auth still owns
 * sign-in and the organization membership; this row decides what they may do.
 */
export const storeMember = pgTable(
  'store_member',
  {
    id: id(),
    storeId: storeId(),
    userId: text('user_id').notNull(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => role.id),
    status: text('status').notNull().default('active'),
    invitedBy: text('invited_by'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('store_member_store_user').on(t.storeId, t.userId),
    check('store_member_status', sql`${t.status} in ('active','invited')`),
  ],
)

/**
 * The store role a pending invitation grants. Better Auth's invitation only
 * knows organization roles, so without this the role chosen on the Staff page
 * would be lost between invite and accept, and the invitee would fall through
 * to the default role instead.
 */
export const storeInvitation = pgTable(
  'store_invitation',
  {
    id: id(),
    storeId: storeId(),
    invitationId: text('invitation_id')
      .notNull()
      .references(() => invitation.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => role.id),
    invitedBy: text('invited_by'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('store_invitation_invitation').on(t.invitationId),
    index('store_invitation_store_email').on(t.storeId, t.email),
  ],
)
