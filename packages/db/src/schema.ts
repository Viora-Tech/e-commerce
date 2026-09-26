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
  /** Admin accent colour (#rrggbb) the owner set as the default for every member; null is Ocean Green. */
  adminAccent: text('admin_accent'),
  /** Pre-order balance collection: auto-request, reminders, unpaid-balance cancel rule. Validated by @commerce/core PreorderStoreSettingsSchema. */
  preorder: jsonb('preorder'),
  createdAt: createdAt(),
})

export const product = pgTable(
  'product',
  {
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
    /**
     * System-generated fixture, e.g. the ₹1 "Payment test" product created by the payments
     * setup wizard. Fetchable directly by id/handle for its own flow (test checkout), but
     * excluded from every listing, search, collection, storefront surface, analytics and
     * inventory query — see `notSystemTest` in `@commerce/core`.
     */
    isSystemTest: boolean('is_system_test').notNull().default(false),
    /** Optional window for the compare-at price; outside it the storefront shows the plain price. */
    saleStartsAt: timestamp('sale_starts_at', { withTimezone: true }),
    saleEndsAt: timestamp('sale_ends_at', { withTimezone: true }),
    /** Purchasable beyond stock, up to `preorderLimit`, while true. Variant rows can override via `variant.preorderOverride`. */
    preorderEnabled: boolean('preorder_enabled').notNull().default(false),
    /** Absolute expected ship date; mutually exclusive with `preorderShipsInDays` in the admin UI (the resolver prefers this one when both are set). */
    preorderShipDate: timestamp('preorder_ship_date', { withTimezone: true }),
    /** "Ships in N days" from the order date; used when `preorderShipDate` is not set. */
    preorderShipsInDays: integer('preorder_ships_in_days'),
    /** Null = unlimited pre-order units beyond stock. */
    preorderLimit: integer('preorder_limit'),
    preorderButtonLabel: text('preorder_button_label').notNull().default('Pre-order'),
    preorderPaymentMode: text('preorder_payment_mode', { enum: ['full', 'fixed', 'percentage'] })
      .notNull()
      .default('full'),
    /** Deposit amount when `preorderPaymentMode` is `fixed`; must be less than the variant's price. */
    preorderDepositPaise: integer('preorder_deposit_paise'),
    /** Deposit percent (1-99) when `preorderPaymentMode` is `percentage`. */
    preorderDepositPercent: integer('preorder_deposit_percent'),
    /** Launch-gated products are hidden from collection/browse listings until `launchAt`, if set. */
    preorderHideFromCollectionsUntilLaunch: boolean('preorder_hide_until_launch')
      .notNull()
      .default(false),
    /** Store-timezone (Asia/Kolkata) instant the product goes on sale. Null = always on sale. */
    launchAt: timestamp('launch_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'product_preorder_deposit_percent',
      sql`${t.preorderDepositPercent} is null or (${t.preorderDepositPercent} between 1 and 99)`,
    ),
  ],
)

/**
 * Optional per-variant override of the product's pre-order settings; any key
 * left out inherits the product's value. See `@commerce/core/preorder` for
 * the merge (`resolvePreorderSettings`). Not yet exposed in the admin UI
 * (product-level settings only in this PR); the column exists so a later PR
 * can add per-variant editing without another migration.
 */
export type VariantPreorderOverride = {
  enabled?: boolean
  shipDate?: string | null
  shipsInDays?: number | null
  limit?: number | null
  buttonLabel?: string
  paymentMode?: 'full' | 'fixed' | 'percentage'
  depositPaise?: number | null
  depositPercent?: number | null
}

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
  /** Partial override of the product's pre-order settings; null inherits every field. */
  preorderOverride: jsonb('preorder_override').$type<VariantPreorderOverride>(),
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
    /**
     * Encrypted at rest (AES-256-GCM, `@commerce/core` `encryptCustomerPhone`) once
     * `scripts/backfill-phone-encryption.ts --apply` has run; a dev/test database with
     * no key set, or a row not yet backfilled, may still hold plaintext digits, which
     * every reader tolerates (`decryptCustomerPhone` passes non-ciphertext through).
     */
    phone: text('phone'),
    /** HMAC-SHA256 blind index of the normalised phone, for equality lookup without decrypting. */
    phoneIndex: text('phone_index'),
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
  (t) => [
    uniqueIndex('customer_store_email').on(t.storeId, t.email),
    index('customer_store_phone_index').on(t.storeId, t.phoneIndex),
  ],
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
  /** Snapshot of the variant's pre-order state when the line was added; re-checked at checkout. */
  preorder: boolean('preorder').notNull().default(false),
})

export const order = pgTable(
  'order',
  {
    id: id(),
    storeId: storeId(),
    number: integer('number').notNull(),
    customerId: uuid('customer_id').references(() => customer.id),
    email: text('email'),
    phone: text('phone'),
    shippingAddressId: uuid('shipping_address_id').references(() => address.id),
    paymentMethod: text('payment_method'),
    /**
     * Lifecycle only. `draft` is a merchant-built order that has not been placed
     * (no stock held, no revenue); `open` is live; `completed` is paid and
     * delivered (derived); `cancelled` is set by hand or by expiry. Money and
     * goods have their own columns below. See `@commerce/core/order-status`.
     */
    status: text('status', { enum: ['draft', 'open', 'completed', 'cancelled'] })
      .notNull()
      .default('open'),
    /** Derived from payment attempts and refunds by `recomputeOrderStatuses`; stored for filtering. */
    paymentStatus: text('payment_status', {
      enum: [
        'unpaid',
        'authorized',
        'partially_paid',
        'paid',
        'partially_refunded',
        'refunded',
        'refund_needed',
      ],
    })
      .notNull()
      .default('unpaid'),
    /** Derived from line quantities, shipments and courier events by `recomputeOrderStatuses`. */
    fulfillmentStatus: text('fulfillment_status', {
      enum: [
        'unfulfilled',
        'partially_fulfilled',
        'fulfilled',
        'shipped',
        'partially_delivered',
        'delivered',
        'returned',
      ],
    })
      .notNull()
      .default('unfulfilled'),
    /**
     * When the amount due at checkout (the whole order, or a pre-order's
     * deposit) was first captured. Set once; the only `order.paid` event is
     * written by the call that sets it.
     */
    checkoutPaidAt: timestamp('checkout_paid_at', { withTimezone: true }),
    /** When the merchant marked the order delivered by hand; courier deliveries come from `shipment`. */
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    subtotalPaise: integer('subtotal_paise').notNull(),
    shippingPaise: integer('shipping_paise').notNull().default(0),
    /** The shipping rate charged, as it was at checkout. Null before shipping rates existed. */
    shippingRateId: uuid('shipping_rate_id'),
    shippingRateName: text('shipping_rate_name'),
    shipping: jsonb('shipping').$type<OrderShippingSnapshot>(),
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
    /**
     * Pre-order deposit bookkeeping. `depositPaise` is null on an order with no
     * deposit-mode pre-order lines (paid in full as normal); `balanceDuePaise`
     * is the part still owed and blocks fulfilment (see
     * `@commerce/core/order/fulfil`) until `balancePaidAt` is set. Collecting the
     * balance itself (a payment link, reminders) is a later PR: this PR only
     * charges the deposit at checkout and keeps the ledger ready.
     */
    depositPaise: integer('deposit_paise'),
    balanceDuePaise: integer('balance_due_paise'),
    balancePaidAt: timestamp('balance_paid_at', { withTimezone: true }),
    /**
     * When the shopper was first asked for the balance (admin "Request balance"
     * or the store's automatic request). Reminders and the unpaid-balance
     * cancel rule count from here; a repeat request keeps the first date.
     */
    balanceRequestedAt: timestamp('balance_requested_at', { withTimezone: true }),
    /** Balance reminders sent so far; the reminder job only moves it forward, one step at a time. */
    balanceRemindersSent: integer('balance_reminders_sent').notNull().default(0),
    /**
     * When the merchant last sent the shopper a payment reminder for an unpaid
     * manual UPI / bank transfer order. The 6-hour resend limit counts from here.
     */
    paymentReminderSentAt: timestamp('payment_reminder_sent_at', { withTimezone: true }),
    /**
     * When the merchant was told this unpaid transfer order will be cancelled
     * automatically. Set once; the cancel waits at least 12 hours after it.
     */
    unpaidCancelNoticeAt: timestamp('unpaid_cancel_notice_at', { withTimezone: true }),
    placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
    /**
     * Set on historical orders brought over from another platform (`shopify`). Such
     * orders are read-only: they never reserve stock, notify, or run app hooks.
     */
    importedFrom: text('imported_from'),
    /** What the source platform said: its order name, financial and fulfilment status. */
    importMeta: jsonb('import_meta').$type<OrderImportMeta>(),
    /**
     * The cart this order was placed from. Unique per store, so a second submit of
     * the same cart finds this order instead of creating another. Null on drafts
     * and imported orders. No foreign key: carts are pruned, orders are kept.
     */
    cartId: uuid('cart_id'),
  },
  (t) => [
    uniqueIndex('order_store_cart_unique')
      .on(t.storeId, t.cartId)
      .where(sql`${t.cartId} is not null`),
    /** The unpaid-order expiry job reads the oldest open orders whose checkout is not paid. */
    index('order_placed_at_unpaid')
      .on(t.storeId, t.placedAt)
      .where(sql`${t.status} = 'open' and ${t.checkoutPaidAt} is null`),
    /** List tabs: Unpaid, Unfulfilled, Completed and Cancelled filter on these, newest first. */
    index('order_store_payment_status').on(t.storeId, t.paymentStatus, t.placedAt),
    index('order_store_fulfillment_status').on(t.storeId, t.fulfillmentStatus, t.placedAt),
    index('order_store_status').on(t.storeId, t.status, t.placedAt),
    check('order_status_check', sql`${t.status} in ('draft', 'open', 'completed', 'cancelled')`),
    check(
      'order_payment_status_check',
      sql`${t.paymentStatus} in ('unpaid', 'authorized', 'partially_paid', 'paid', 'partially_refunded', 'refunded', 'refund_needed')`,
    ),
    check(
      'order_fulfillment_status_check',
      sql`${t.fulfillmentStatus} in ('unfulfilled', 'partially_fulfilled', 'fulfilled', 'shipped', 'partially_delivered', 'delivered', 'returned')`,
    ),
    /** The balance job reads pre-orders with money still owed. */
    index('order_balance_due')
      .on(t.storeId, t.placedAt)
      .where(sql`${t.balanceDuePaise} > 0 and ${t.balancePaidAt} is null`),
  ],
)

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
  /** Sold under pre-order rules (the product/variant had pre-order on at order time). */
  preorder: boolean('preorder').notNull().default(false),
  /** Expected ship date shown on the order/email; resolved from the product's settings at order time. */
  preorderShipDate: timestamp('preorder_ship_date', { withTimezone: true }),
})

export const PAYMENT_STATUSES = [
  'created',
  'pending',
  'authorized',
  'captured',
  'failed',
  'cancelled',
  'refunded',
] as const
export type PaymentRowStatus = (typeof PAYMENT_STATUSES)[number]

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
    /**
     * One row per attempt. `created`: recorded, gateway not asked yet. Moves only
     * forward (see core `nextPaymentStatus`); `failed` and `cancelled` attempts
     * stay as history and a retry adds a new row.
     */
    status: text('status', { enum: PAYMENT_STATUSES }).notNull(),
    amountPaise: integer('amount_paise').notNull(),
    /** 1 for the first attempt on an order, then 2, 3… for each retry. */
    attempt: integer('attempt').notNull().default(1),
    /** `<orderId>:<attempt>`; sent to the gateway so one attempt is never charged twice. */
    idempotencyKey: text('idempotency_key'),
    /** Set by the one caller that asks the gateway for this attempt; a second caller backs off. */
    gatewayRequestedAt: timestamp('gateway_requested_at', { withTimezone: true }),
    /** Why the attempt failed (gateway error, decline reason). */
    error: text('error'),
    /**
     * Money was captured but the order cannot keep it: the order was cancelled
     * or expired first, or another attempt had already paid it. Shown on the
     * admin order page until someone refunds it.
     */
    refundNeeded: boolean('refund_needed').notNull().default(false),
    /** Opt-out of the one-capture-per-order rule, for split payments taken on purpose. */
    multiCapture: boolean('multi_capture').notNull().default(false),
    /**
     * `order` pays the checkout amount (the whole order, or a pre-order's
     * deposit); `balance` collects a deposit pre-order's remaining balance
     * later. Balance attempts are `multi_capture` so they sit beside the
     * deposit's capture, and have their own one-open / one-capture guards.
     */
    purpose: text('purpose', { enum: ['order', 'balance'] })
      .notNull()
      .default('order'),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      'payment_status_check',
      sql`${t.status} in ('created', 'pending', 'authorized', 'captured', 'failed', 'cancelled', 'refunded')`,
    ),
    uniqueIndex('payment_store_idempotency_key')
      .on(t.storeId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
    /* At most one gateway capture per order. Gift cards are split tender by
       design; a capture flagged refund-needed is money on its way back. */
    uniqueIndex('payment_one_capture_per_order')
      .on(t.storeId, t.orderId)
      .where(
        sql`${t.status} = 'captured' and ${t.provider} <> 'gift_card' and not ${t.multiCapture} and not ${t.refundNeeded}`,
      ),
    check('payment_purpose_check', sql`${t.purpose} in ('order', 'balance')`),
    /* One balance attempt in flight per order: two "Pay balance" taps get the same one. */
    uniqueIndex('payment_one_open_balance_attempt')
      .on(t.storeId, t.orderId)
      .where(sql`${t.purpose} = 'balance' and ${t.status} in ('created', 'pending', 'authorized')`),
    /* And at most one balance capture kept per order. */
    uniqueIndex('payment_one_balance_capture')
      .on(t.storeId, t.orderId)
      .where(sql`${t.purpose} = 'balance' and ${t.status} = 'captured' and not ${t.refundNeeded}`),
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
    weightGrams: integer('weight_grams'),
    lengthCm: integer('length_cm'),
    widthCm: integer('width_cm'),
    heightCm: integer('height_cm'),
    /** Whether this parcel is insured, from the per-shipment toggle (defaults from the store's threshold). */
    insured: boolean('insured').notNull().default(false),
    declaredValuePaise: integer('declared_value_paise'),
    /** `none` until the courier reports an NDR; the courier app's queue works from this. */
    ndrStatus: text('ndr_status', {
      enum: ['none', 'pending', 'action_taken', 'resolved'],
    })
      .notNull()
      .default('none'),
    ndrReason: text('ndr_reason'),
    ndrRaisedAt: timestamp('ndr_raised_at', { withTimezone: true }),
    ndrAction: text('ndr_action', { enum: ['reattempt', 'change_address', 'rto'] }),
    ndrActionAt: timestamp('ndr_action_at', { withTimezone: true }),
    ndrActionRef: text('ndr_action_ref'),
    rtoDeliveredAt: timestamp('rto_delivered_at', { withTimezone: true }),
    pickupId: uuid('pickup_id'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('shipment_provider_waybill').on(t.provider, t.waybill),
    index('shipment_store_ndr').on(t.storeId, t.ndrStatus),
    index('shipment_pickup_id').on(t.pickupId),
  ],
)

/**
 * A pickup request booked with a courier for a batch of shipments (Delhivery:
 * `schedulePickup`, a Create Pickup API call). `shipment.pickup_id` points
 * back here; a manifest groups some or all of a pickup's shipments into one
 * printable batch of labels.
 */
export const shipmentPickup = pgTable(
  'shipment_pickup',
  {
    id: id(),
    storeId: storeId(),
    provider: text('provider').notNull(),
    scheduledFor: date('scheduled_for').notNull(),
    timeFrom: text('time_from').notNull(),
    timeTo: text('time_to'),
    expectedPackageCount: integer('expected_package_count').notNull().default(0),
    status: text('status', {
      enum: ['requested', 'scheduled', 'completed', 'failed'],
    })
      .notNull()
      .default('requested'),
    providerRef: text('provider_ref'),
    error: text('error'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('shipment_pickup_store').on(t.storeId, t.scheduledFor)],
)

/** A batch of shipments handed to the courier together, printed as one sheet. Our own record; not every courier has a matching API concept. */
export const shipmentManifest = pgTable(
  'shipment_manifest',
  {
    id: id(),
    storeId: storeId(),
    provider: text('provider').notNull(),
    pickupId: uuid('pickup_id').references(() => shipmentPickup.id),
    shipmentIds: uuid('shipment_ids').array().notNull().default([]),
    providerRef: text('provider_ref'),
    createdAt: createdAt(),
  },
  (t) => [index('shipment_manifest_store').on(t.storeId, t.createdAt)],
)

/**
 * Dedupe log for the tracking webhook, the same pattern as `payment_event`:
 * one row per (store, provider, event id), inserted before the tracking
 * update is applied so a retried delivery from the courier is a no-op.
 */
export const shipmentWebhookEvent = pgTable(
  'shipment_webhook_event',
  {
    id: id(),
    storeId: storeId(),
    provider: text('provider').notNull(),
    eventId: text('event_id').notNull(),
    waybill: text('waybill').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status', { enum: ['pending', 'processed', 'failed'] })
      .notNull()
      .default('pending'),
    error: text('error'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('shipment_webhook_event_provider_event').on(t.storeId, t.provider, t.eventId),
  ],
)

/**
 * Cached courier wallet balance and the merchant's low-balance threshold, one
 * row per (store, provider). Delhivery has no confirmed public balance API
 * (see packages/shipping-delhivery), so `balancePaise` is often set by the
 * merchant themselves from their courier dashboard rather than fetched; a
 * provider that does implement `getWalletBalance` overwrites it on refresh.
 */
export const courierWalletBalance = pgTable(
  'courier_wallet_balance',
  {
    id: id(),
    storeId: storeId(),
    provider: text('provider').notNull(),
    balancePaise: integer('balance_paise').notNull().default(0),
    lowBalanceThresholdPaise: integer('low_balance_threshold_paise').notNull().default(50000),
    source: text('source', { enum: ['api', 'manual'] })
      .notNull()
      .default('manual'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('courier_wallet_balance_store_provider').on(t.storeId, t.provider)],
)

/** One PIN code rule of a shipping zone: `560*` (prefix) or `560001` (exact). */
export type ShippingPincodeRule = { pattern: string; mode: 'include' | 'exclude' }

/**
 * Where a set of shipping rates applies: states and/or PIN code rules. A zone
 * with no states and no include rules covers all of India. When several zones
 * match an address the most specific one wins (see `pickZone` in core).
 *
 * Pattern from Saleor's `ShippingZone` and `ShippingMethodPostalCodeRule`
 * (BSD-3): postal rules include or exclude, kept beside the zone.
 */
export const shippingZone = pgTable(
  'shipping_zone',
  {
    id: id(),
    storeId: storeId(),
    name: text('name').notNull(),
    /** Two-letter state codes (`KA`, `MH`). */
    stateCodes: text('state_codes').array().notNull().default([]),
    pincodeRules: jsonb('pincode_rules').$type<ShippingPincodeRule[]>().notNull().default([]),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('shipping_zone_store').on(t.storeId, t.position)],
)

export type ShippingRateCondition = 'none' | 'order_value' | 'weight'

/**
 * A price the shopper can pick at checkout. `condition` bounds it by order
 * value (paise, after discounts) or cart weight (grams): `min` is included,
 * `max` is not, so bands 0 to 500 and 500 to 1000 meet without a gap.
 * `free_above_paise` makes it free from that order value up.
 *
 * Pattern from Saleor's `ShippingMethod` (BSD-3, price or weight based with
 * bounds) and Medusa's shipping options (MIT, flat or calculated per option).
 */
export const shippingRate = pgTable(
  'shipping_rate',
  {
    id: id(),
    storeId: storeId(),
    zoneId: uuid('zone_id')
      .notNull()
      .references(() => shippingZone.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    condition: text('condition', { enum: ['none', 'order_value', 'weight'] })
      .notNull()
      .default('none'),
    minValue: integer('min_value'),
    maxValue: integer('max_value'),
    pricePaise: integer('price_paise').notNull().default(0),
    freeAbovePaise: integer('free_above_paise'),
    /**
     * Cash on delivery fee for this rate. Null keeps the store's COD fee
     * (Settings → Payments); a number replaces it, 0 waives it. Never both.
     */
    codSurchargePaise: integer('cod_surcharge_paise'),
    /** Delivery promise for this rate; null uses the courier's estimate. */
    minTransitDays: integer('min_transit_days'),
    maxTransitDays: integer('max_transit_days'),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('shipping_rate_zone').on(t.zoneId, t.position)],
)

/** What the shopper picked at checkout, kept on the order as it was charged. */
export type OrderShippingSnapshot = {
  rateId: string
  rateName: string
  zoneId: string
  zoneName: string
  /** List price before a free-shipping discount or threshold. */
  listPricePaise: number
  /** What was charged for shipping; equals `order.shipping_paise`. */
  pricePaise: number
  /** COD fee this rate set, or null when the store's COD fee applied. */
  codSurchargePaise: number | null
  minTransitDays: number | null
  maxTransitDays: number | null
}

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

export type SenderEmailStatus = 'pending' | 'verified' | 'failed'

/**
 * The address a store's customer emails come from (Settings → Notifications →
 * Sender email). One per store; the domain is a domain identity in the
 * platform's SES account. `domain` is unique across the platform, and the
 * `sender_domain_taken` SECURITY DEFINER function also refuses a parent or
 * subdomain of another store's domain (SES lets subdomains inherit a parent's
 * verification). Until `status` is `verified`, mail goes out from the
 * platform's address with Reply-To set to `email`.
 */
export const senderEmail = pgTable(
  'sender_email',
  {
    id: id(),
    storeId: storeId(),
    email: text('email').notNull(),
    domain: text('domain').notNull().unique(),
    /** Shown before the address; null means the store name. */
    displayName: text('display_name'),
    status: text('status').$type<SenderEmailStatus>().notNull().default('pending'),
    /** Why verification failed or is stuck, as a code the admin words (`records_not_found`, ...). */
    error: text('error'),
    /** Which identity provider holds the domain: `ses` or the offline `dev` one. */
    provider: text('provider').notNull(),
    dkimTokens: jsonb('dkim_tokens').$type<string[]>().notNull().default([]),
    dkimHostedZone: text('dkim_hosted_zone'),
    /** Custom MAIL FROM (`bounce.<domain>`); null when SES refused it. */
    mailFromDomain: text('mail_from_domain'),
    mailFromStatus: text('mail_from_status').$type<SenderEmailStatus>(),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sender_email_store').on(t.storeId),
    check('sender_email_status', sql`${t.status} in ('pending', 'verified', 'failed')`),
    check(
      'sender_email_mail_from_status',
      sql`${t.mailFromStatus} is null or ${t.mailFromStatus} in ('pending', 'verified', 'failed')`,
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
    /** This member's own admin accent (#rrggbb); null falls back to the store's `admin_accent`. */
    adminAccent: text('admin_accent'),
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

/**
 * Transactional outbox: every place that today enqueues a notification, an
 * app hook or a marketing trigger directly instead writes one row here, in
 * the same transaction as the state change. A worker relay reads
 * undispatched rows and fans them out to consumers, so a commit can never
 * leave an event unsent and a crash can never send one that never happened.
 *
 * Pattern from Trigger.dev's task-run event log (Apache-2.0) and Temporal's
 * event-sourced workflow history (MIT): durable append log first, delivery
 * as a separate, retryable concern. Ours is plain Postgres plus BullMQ, not
 * their engines.
 */
export const outboxEvent = pgTable(
  'outbox_event',
  {
    id: id(),
    storeId: storeId(),
    /** Reuses existing event names ('order.placed', 'refund.created', ...). */
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: createdAt(),
    /** Set once the relay has enqueued a job for every consumer of this row. */
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [
    index('outbox_event_undispatched')
      .on(t.storeId, t.createdAt)
      .where(sql`${t.dispatchedAt} is null`),
  ],
)
