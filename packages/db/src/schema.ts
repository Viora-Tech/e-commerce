import { eq, sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { invitation } from './auth-schema'
// Imports schema.ts back: market-schema.ts must not read any binding from here while loading.
import { market } from './market-schema'
import type { PixelTracking } from './pixel-schema'

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
  /** Storefront price format, Shopify-style (`Rs. {{amount}}`); null = currency's own. Display only. */
  moneyFormat: text('money_format'),
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
  /**
   * The merchant's own Google / Apple / Facebook / Truecaller sign-in app credentials, when
   * they do not use the platform's. Secret fields encrypted. See @commerce/core shopper-login.
   */
  loginProviders: jsonb('login_providers'),
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
  /** Returns policy: window in days, allowed reasons, auto-restock, refund default. Validated by @commerce/core ReturnPolicySchema. */
  returns: jsonb('returns'),
  /** Answers from the guided /onboarding flow: what the store sells, where it sells today. Validated by @commerce/core BusinessProfileSchema. */
  businessProfile: jsonb('business_profile'),
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
    /** Shopify Standard Product Taxonomy category id (vendored, trimmed copy); productType stays separate free text. */
    categoryId: text('category_id'),
    productType: text('product_type'),
    tags: text('tags').array().notNull().default([]),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    /**
     * Search keywords the merchant chose (Search keywords card), primary first. They only steer
     * "Write with AI" for the search title and description; the storefront never prints them.
     */
    seoKeywords: text('seo_keywords').array().notNull().default([]),
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
    /**
     * The note under the pre-order button, in the cart, at checkout and on the order email
     * (#936); null uses the store's default (`store.preorder.note`). May use `{ship_date}`.
     */
    preorderNote: text('preorder_note'),
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
    /* A product page is found by its handle. Unique per store: `uniqueHandle()` checked and then
       inserted, so two saves at once could both take one (schema review 2026-10-27). */
    uniqueIndex('product_store_handle').on(t.storeId, t.handle),
    index('product_store_status').on(t.storeId, t.status, t.createdAt),
  ],
)

/**
 * Optional per-variant override of the product's pre-order settings; any key
 * left out inherits the product's value. See `@commerce/core/preorder` for
 * the merge (`resolvePreorderSettings`). The admin edits `enabled: false` only, the
 * variant's "Allow pre-order" switch (a variant sells on pre-order when the product has it on
 * and the variant allows it); the other keys are not exposed yet.
 */
export type VariantPreorderOverride = {
  /** False: this variant never sells on pre-order. Cannot turn pre-order on by itself. */
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
export const productOption = pgTable(
  'product_option',
  {
    id: id(),
    storeId: storeId(),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('product_option_product').on(t.productId)],
)

export const productOptionValue = pgTable(
  'product_option_value',
  {
    id: id(),
    storeId: storeId(),
    optionId: uuid('option_id')
      .notNull()
      .references(() => productOption.id),
    value: text('value').notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('product_option_value_option').on(t.optionId)],
)

/**
 * Uploaded once, referenced anywhere (products, variants, pages). Rows are
 * created `pending` when the browser asks for a presigned upload and become
 * `ready` on confirm; a nightly sweep can drop stale pending rows. `key` is
 * null for imported catalogue images that live on someone else's CDN.
 */
export const media = pgTable(
  'media',
  {
    id: id(),
    storeId: storeId(),
    url: text('url').notNull(),
    /** Object key in the storage provider; see @commerce/storage mediaKey. */
    key: text('key'),
    /** Which provider holds the object, so deletes go to the right bucket. */
    provider: text('provider'),
    contentType: text('content_type'),
    /** Bytes as declared at presign time; updated to the real size on confirm and again after processing. */
    size: integer('size'),
    alt: text('alt'),
    width: integer('width'),
    height: integer('height'),
    /**
     * `pending` (awaiting confirm) → `processing` (image queued for the
     * upload-time pipeline) → `ready` (or `failed`, retried by the same job
     * id). Imported/legacy rows with no pipeline run go straight to `ready`
     * with `variants` null; the loader then falls back to `url`.
     */
    status: text('status', { enum: ['pending', 'processing', 'ready', 'failed'] })
      .notNull()
      .default('ready'),
    /**
     * `{ [width]: { avif: url, webp: url } }` for each generated width, plus
     * the cleaned master's own width/height (already on the row). Null until
     * the pipeline runs; the loader and `<Picture>` fall back to `url` when
     * null. See packages/core/src/media/pipeline.ts.
     */
    variants: jsonb('variants'),
    /** Base64 ThumbHash (~20-40 bytes decoded) used as the blur-up placeholder. Null until processed. */
    thumbhash: text('thumbhash'),
    /** Set when the pipeline finishes (success or failure); null while pending/processing. */
    processedAt: timestamp('processed_at', { withTimezone: true }),
    /** Last pipeline error, kept for the admin media UI and for debugging a stuck `failed` row. */
    processError: text('process_error'),
    createdAt: createdAt(),
  },
  (t) => [index('media_store_created').on(t.storeId, t.createdAt)],
)

export const productMedia = pgTable(
  'product_media',
  {
    id: id(),
    storeId: storeId(),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id),
    mediaId: uuid('media_id')
      .notNull()
      .references(() => media.id),
    position: integer('position').notNull().default(0),
  },
  (t) => [
    index('product_media_product').on(t.productId, t.position),
    index('product_media_media').on(t.mediaId),
  ],
)

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
  (t) => [
    uniqueIndex('collection_product_unique').on(t.collectionId, t.productId),
    index('collection_product_product').on(t.productId),
  ],
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
    /** Alternate `blog.<suffix>` template of the live theme; null uses the default. */
    templateSuffix: text('template_suffix'),
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
    /** Alternate `article.<suffix>` template of the live theme; null uses the default. */
    templateSuffix: text('template_suffix'),
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

/** Units the product page offers for a variant's weight (`variant.weight_unit`). */
const VARIANT_WEIGHT_UNITS = ['g', 'kg', 'lb', 'oz'] as const

export const variant = pgTable(
  'variant',
  {
    id: id(),
    storeId: storeId(),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id),
    sku: text('sku'),
    barcode: text('barcode'),
    title: text('title').notNull(),
    pricePaise: integer('price_paise'),
    mrpPaise: integer('mrp_paise'),
    /** What the merchant paid; never shown to shoppers. */
    costPaise: integer('cost_paise'),
    taxable: boolean('taxable').notNull().default(true),
    /** false = always purchasable regardless of inventory_level. */
    trackInventory: boolean('track_inventory').notNull().default(true),
    weightGrams: integer('weight_grams'),
    /**
     * Unit the merchant types the weight in on the product page; `weight_grams` stays the source of
     * truth for shipping. Null shows kilograms.
     */
    weightUnit: text('weight_unit', { enum: VARIANT_WEIGHT_UNITS }),
    /** Customs fields printed on international labels and invoices. */
    hsCode: text('hs_code'),
    countryOfOrigin: text('country_of_origin'),
    /** GST rate for this variant; null uses the store default. Ignored when `taxable` is false. */
    gstRatePercent: integer('gst_rate_percent'),
    /** One of the store's named boxes (shipping settings JSON); null with dims set below means a custom box. */
    boxPresetId: text('box_preset_id'),
    packageLengthCm: integer('package_length_cm'),
    packageWidthCm: integer('package_width_cm'),
    packageHeightCm: integer('package_height_cm'),
    position: integer('position').notNull().default(0),
    mediaId: uuid('media_id').references(() => media.id),
    /**
     * Variants referenced by order lines are never deleted; removing one from
     * the matrix archives it so old orders keep their titles and prices.
     */
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    /**
     * Hidden on the storefront (#934): never shown, priced or sold there (our themes, imported
     * themes, feeds, search), but it stays in admin, orders and history. Shopify's "unavailable".
     */
    hiddenOnStore: boolean('hidden_on_store').notNull().default(false),
    /** Partial override of the product's pre-order settings; null inherits every field. */
    preorderOverride: jsonb('preorder_override').$type<VariantPreorderOverride>(),
    /** Kept current by the `touch_updated_at` trigger (0177), so no write path can forget it. */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'variant_weight_unit_check',
      sql`${t.weightUnit} is null or ${t.weightUnit} in ('g', 'kg', 'lb', 'oz')`,
    ),
    index('variant_product').on(t.productId),
    index('variant_store_sku').on(t.storeId, t.sku).where(sql`${t.sku} is not null`),
  ],
)

export const variantOptionValue = pgTable(
  'variant_option_value',
  {
    id: id(),
    storeId: storeId(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => variant.id),
    optionValueId: uuid('option_value_id')
      .notNull()
      .references(() => productOptionValue.id),
  },
  (t) => [
    index('variant_option_value_variant').on(t.variantId),
    index('variant_option_value_value').on(t.optionValueId),
  ],
)

/**
 * A variant's own images, in order (Black shows its three photos). Every row points at media in
 * the product's gallery; `variant.media_id` mirrors position 0, so the single-image readers
 * (cart and order lines, feeds, catalogue sync, Liquid `variant.image`) keep working. Written
 * only through `@commerce/core` catalog/variant-media.ts, which keeps the two in step.
 */
export const variantMedia = pgTable(
  'variant_media',
  {
    id: id(),
    storeId: storeId(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => variant.id, { onDelete: 'cascade' }),
    mediaId: uuid('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
  },
  (t) => [
    uniqueIndex('variant_media_unique').on(t.variantId, t.mediaId),
    index('variant_media_media').on(t.mediaId),
  ],
)

/**
 * SOURCE OF TRUTH: business, BUSINESS_PAYOUT_MODES, BUSINESS_ROUTE_STATUSES — WHAT one legal
 * entity (one PAN) selling through this store / WHY GST is registered per PAN per state, and a
 * warehouse may belong to a different legal business than the store's main one. Exactly one
 * `is_primary` business per store (`business_one_primary`). Payout columns are for a later
 * phase (Razorpay Route linked accounts) and are not read yet. Rules: @commerce/core
 * tax/registrations.ts.
 */
const BUSINESS_PAYOUT_MODES = ['main', 'razorpay_route'] as const
/** A check constraint's `in (...)` list, from the same array the column's enum uses. */
const oneOf = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '))
const BUSINESS_ROUTE_STATUSES = [
  'none',
  'created',
  'under_review',
  'activated',
  'suspended',
] as const

export const business = pgTable(
  'business',
  {
    id: id(),
    storeId: storeId(),
    /** Name on the PAN card. */
    legalName: text('legal_name').notNull(),
    /** Shop name, when the business trades under another name. */
    tradeName: text('trade_name'),
    pan: text('pan').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    payoutMode: text('payout_mode', { enum: BUSINESS_PAYOUT_MODES }).notNull().default('main'),
    razorpayAccountId: text('razorpay_account_id'),
    routeStatus: text('route_status', { enum: BUSINESS_ROUTE_STATUSES }).notNull().default('none'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('business_store_pan').on(t.storeId, t.pan),
    uniqueIndex('business_one_primary').on(t.storeId).where(sql`${t.isPrimary}`),
    check('business_payout_mode_check', sql`${t.payoutMode} in (${oneOf(BUSINESS_PAYOUT_MODES)})`),
    check(
      'business_route_status_check',
      sql`${t.routeStatus} in (${oneOf(BUSINESS_ROUTE_STATUSES)})`,
    ),
  ],
)

/**
 * SOURCE OF TRUTH: gst_registration, gstRegistration, GST_REGISTRATION_TYPES — WHAT one GSTIN a business holds in one
 * state / WHY invoices must come from the dispatching state's GSTIN, so a store can hold many.
 * `state_code` is generated from the GSTIN's first two digits so it can never disagree. The
 * one `is_default` row is mirrored into `store.gstin` for code that predates registrations.
 * Rules (PAN must match the business, one default): @commerce/core tax/registrations.ts.
 */
const GST_REGISTRATION_TYPES = ['regular', 'composition'] as const

export const gstRegistration = pgTable(
  'gst_registration',
  {
    id: id(),
    storeId: storeId(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => business.id),
    gstin: text('gstin').notNull(),
    /** GST's two-digit state code, e.g. '06' for Haryana. Always the GSTIN's first two characters. */
    stateCode: text('state_code').notNull().generatedAlwaysAs(sql`left(gstin, 2)`),
    registrationType: text('registration_type', { enum: GST_REGISTRATION_TYPES })
      .notNull()
      .default('regular'),
    /** Principal place of business in this state: { line1, line2, city, pincode }. */
    legalAddress: jsonb('legal_address'),
    tradeName: text('trade_name'),
    email: text('email'),
    phone: text('phone'),
    /** Up to 5 characters; `{GST}` in a numbering series prints it on this GSTIN's invoices. */
    invoicePrefix: text('invoice_prefix'),
    effectiveFrom: date('effective_from'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('gst_registration_store_gstin').on(t.storeId, t.gstin),
    uniqueIndex('gst_registration_one_default').on(t.storeId).where(sql`${t.isDefault}`),
    index('gst_registration_business').on(t.businessId),
    check(
      'gst_registration_type_check',
      sql`${t.registrationType} in (${oneOf(GST_REGISTRATION_TYPES)})`,
    ),
    check(
      'gst_registration_invoice_prefix_check',
      sql`${t.invoicePrefix} is null or char_length(${t.invoicePrefix}) <= 5`,
    ),
  ],
)

/**
 * Where stock physically sits. Every store has exactly one default location,
 * created with the store (or by the inventory_level insert trigger). The default
 * location sells online; others do when the merchant turns "Ships online orders"
 * on, and checkout routes each order to them (@commerce/core fulfilment/routing.ts).
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
    /** Routing order among locations that sell online: lower ships first. The default is 0. */
    priority: integer('priority').notNull().default(0),
    /** The GSTIN goods dispatched from here are billed under. Null: not chosen yet. */
    gstRegistrationId: uuid('gst_registration_id').references(() => gstRegistration.id),
    /**
     * Couriers collect parcels from this location's address (and returns come back to it).
     * Null: shipments use the store-wide return address in Settings › Shipping, as before.
     */
    courierPickup: jsonb('courier_pickup').$type<LocationCourierPickup>(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('location_one_default').on(t.storeId).where(sql`${t.isDefault}`)],
)

/** A location's courier pickup: its own address, plus the names the courier knows it by. */
export type LocationCourierPickup = {
  /** The pickup location (warehouse) name registered on the courier's dashboard. */
  pickupName: string
  /** Who hands parcels over; printed on labels. Blank uses the location's name. */
  contactName: string
  /** Blank uses the location's phone. */
  phone: string
}

/**
 * Stock of one variant at one location. on_hand is physically there, reserved
 * (shown as Committed) is held by open orders, incoming is on purchase orders or
 * transfers not yet received. Available = on_hand - reserved.
 *
 * fulfils_online mirrors its location's "Ships online orders" (kept in sync by
 * trigger). A variant may sell from several locations: what the storefront shows
 * is the sum over those rows (`sellableStock` in stock.ts), and an order reserves
 * at the location its parcel ships from. Never join on variant_id alone expecting
 * one row.
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
    index('inventory_level_variant_sellable').on(t.variantId).where(sql`${t.fulfilsOnline}`),
    index('inventory_level_location').on(t.locationId),
  ],
)

/** Inventory rows at locations that sell online (there may be several per variant). */
export const sellableLevel = eq(inventoryLevel.fulfilsOnline, true)

/** Every change to on_hand, with why. Reconciles counts against the merchant's memory. */
export const inventoryAdjustment = pgTable(
  'inventory_adjustment',
  {
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
  },
  (t) => [index('inventory_adjustment_variant').on(t.variantId, t.createdAt)],
)

// purchase_order and purchase_order_line: purchasing-schema.ts (suppliers, landed cost).

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

export const transferLine = pgTable(
  'transfer_line',
  {
    id: id(),
    storeId: storeId(),
    transferId: uuid('transfer_id')
      .notNull()
      .references(() => transfer.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => variant.id),
    quantity: integer('quantity').notNull(),
  },
  (t) => [index('transfer_line_transfer').on(t.transferId)],
)

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
    /**
     * When this phone was proven to be the customer's: a sign-in code sent to it, or
     * Truecaller. Checkout, the profile form and staff edits set a phone without proof, so
     * they leave this null; phone sign-in only matches a customer whose phone is proven
     * (or who has no email, i.e. was created by phone sign-in itself).
     */
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    name: text('name'),
    /**
     * Business details for B2B invoices: a validated GSTIN (upper case, `validateGstin`) and
     * the legal name. Saved from a checkout that carried them, or typed by staff.
     */
    gstin: text('gstin'),
    businessName: text('business_name'),
    /** Snapshot of the address from the latest order, so the profile card needs no join. */
    defaultAddress: jsonb('default_address').$type<CustomerAddress>(),
    tags: text('tags').array().notNull().default([]),
    note: text('note'),
    acceptsMarketing: boolean('accepts_marketing').notNull().default(false),
    /** Opted in to WhatsApp marketing (broadcasts and promotional automations). */
    acceptsWhatsapp: boolean('accepts_whatsapp').notNull().default(false),
    /** Opted in to SMS marketing. History of every change: `marketing_consent_event`. */
    acceptsSms: boolean('accepts_sms').notNull().default(false),
    /** When and where the latest email consent was given, e.g. `newsletter`, `checkout`, `admin`. */
    marketingConsentAt: timestamp('marketing_consent_at', { withTimezone: true }),
    marketingConsentSource: text('marketing_consent_source'),
    /** Set by the unsubscribe link; no marketing email or automation reaches the customer after it. */
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    /**
     * Set when the customer's personal data was erased (a deletion request).
     * The row stays so orders and invoices keep their link; name, email,
     * phone and addresses are gone. See `@commerce/core` `anonymiseCustomer`.
     */
    anonymisedAt: timestamp('anonymised_at', { withTimezone: true }),
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
  | 'business'
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
  /** The short link (Growth → Links) the visit came through. */
  linkId?: string | undefined
  /** An affiliate's referral code from `?ref=` (Affiliates app). */
  ref?: string | undefined
  /** ISO time of the touch. */
  at: string
}

/**
 * One address table, reused by customers and orders. state_code drives CGST/SGST vs IGST.
 * Abroad (Markets): `state_code` is '' (it is an Indian GST state code only), `province` holds
 * the region as written there, and `pincode` holds the postal code, '' where the country has
 * none (UAE). Checkout and drafts validate an Indian address (GST state, 6-digit PIN) in code;
 * there is no database check, because imported Shopify addresses are often incomplete and an
 * import must not fail on one of them.
 */
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
  /** State, emirate or province outside India; null in India (the GST state is `state_code`). */
  province: text('province'),
  phone: text('phone').notNull(),
})

/**
 * A shopper's saved address book (storefront account). Separate from `address`,
 * which holds immutable order snapshots. At most one default per customer.
 */
/** The tag a shopper puts on a saved address; the same list as `ADDRESS_LABELS` in core. */
const CUSTOMER_ADDRESS_LABELS = ['home', 'office', 'other'] as const

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
    /** Region outside India, as on `address.province`; null in India. */
    province: text('province'),
    phone: text('phone').notNull(),
    /** Home, Office or Other on the checkout's address cards; null when the shopper never said. */
    label: text('label', { enum: CUSTOMER_ADDRESS_LABELS }),
    /** The default shipping address (checkout and the storefront book call it "default"). */
    isDefault: boolean('is_default').notNull().default(false),
    /**
     * The default billing address. Off on every row means billing follows the default
     * shipping address. At most one per customer.
     */
    isDefaultBilling: boolean('is_default_billing').notNull().default(false),
    /** Company name for a billing address (the GST invoice bills to it); null for a person. */
    businessName: text('business_name'),
    /** A validated GSTIN (upper case, `validateGstin`) billed at this address; null for none. */
    gstin: text('gstin'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('customer_address_customer').on(t.customerId),
    uniqueIndex('customer_address_one_default').on(t.customerId).where(sql`is_default`),
    uniqueIndex('customer_address_one_default_billing')
      .on(t.customerId)
      .where(sql`is_default_billing`),
    check('customer_address_label_check', sql`${t.label} in (${oneOf(CUSTOMER_ADDRESS_LABELS)})`),
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

export const cart = pgTable(
  'cart',
  {
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
    /** Pixels app: the shopper's fbp/fbc, IP, UA and consent, from the storefront collector. */
    tracking: jsonb('tracking').$type<PixelTracking>(),
    /**
     * Markets: the market the cart was filled in (the storefront's subfolder, domain or the
     * shopper's choice) and the currency its prices were shown in. Null: the primary market.
     */
    marketId: uuid('market_id').references(() => market.id, { onDelete: 'set null' }),
    presentmentCurrency: text('presentment_currency'),
    /** ISO 3166-1 country the shopper is buying from (the selector, else the edge's country). */
    countryCode: text('country_code'),
    createdAt: createdAt(),
    /** Touched on every line or contact change; the abandoned window is measured from here. */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    recoverySentAt: timestamp('recovery_sent_at', { withTimezone: true }),
  },
  (t) => [
    /* Abandoned-checkout job and the cart prune read carts by status and age. */
    index('cart_store_status_updated').on(t.storeId, t.status, t.updatedAt),
    index('cart_customer').on(t.customerId).where(sql`${t.customerId} is not null`),
  ],
)

export const cartLine = pgTable(
  'cart_line',
  {
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
  },
  (t) => [
    /* Every storefront page reads the cart for the header count (layout `requestCart`). */
    index('cart_line_cart').on(t.cartId),
    index('cart_line_variant').on(t.variantId),
  ],
)

/** How GST applies to an order (`order.tax_regime`); exports are zero-rated. */
const ORDER_TAX_REGIMES = ['domestic_gst', 'export_lut', 'export_igst'] as const
export type OrderTaxRegime = (typeof ORDER_TAX_REGIMES)[number]

export const order = pgTable(
  'order',
  {
    id: id(),
    storeId: storeId(),
    /**
     * The order number (#2374). A draft saved since 0200 holds minus its draft number here
     * until it converts and takes the next order number, so drafts leave no gaps in the series.
     */
    number: integer('number').notNull(),
    /**
     * The draft's own number (#D12, audit #26), from `store_counter` `draft`. Kept after the
     * draft converts. Null on orders that never were drafts.
     */
    draftNumber: integer('draft_number'),
    customerId: uuid('customer_id').references(() => customer.id),
    email: text('email'),
    phone: text('phone'),
    /** Business buyer's GSTIN from checkout (Settings → Checkout), validated; the GST invoice prints it. */
    buyerGstin: text('buyer_gstin'),
    /** Business name typed beside the GSTIN; the GST invoice bills to it. */
    buyerBusinessName: text('buyer_business_name'),
    /** The shopper's note from checkout, when the store turned order notes on. */
    customerNote: text('customer_note'),
    shippingAddressId: uuid('shipping_address_id').references(() => address.id),
    /**
     * Where the bill goes when it is not the shipping address (draft orders, "Billing address
     * is the same as shipping" unticked). Null: billing is the shipping address, as at checkout.
     */
    billingAddressId: uuid('billing_address_id').references(() => address.id),
    paymentMethod: text('payment_method'),
    /**
     * Paid through a gateway running on its test keys (Settings → Payments,
     * Live/Test): no real money moved. Test orders are left out of analytics,
     * sales reports and GST invoices, and "Delete test orders" removes them.
     */
    isTest: boolean('is_test').notNull().default(false),
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
    /**
     * The GSTIN this order is billed from: the GST registration of the location its goods
     * sell from, else the default one. Its invoices, credit notes and vouchers use it. Null
     * on orders placed before GST registrations, or in a store without any.
     */
    gstRegistrationId: uuid('gst_registration_id').references(() => gstRegistration.id),
    /** Where the GST split was worked out from, as it was at checkout. */
    taxOrigin: jsonb('tax_origin').$type<OrderTaxOrigin>(),
    tags: text('tags').array().notNull().default([]),
    /** Snapshot of the cart's attribution when the order was placed; drives Marketing reports. */
    attribution: jsonb('attribution').$type<MarketingAttribution>(),
    /** Snapshot of the cart's `tracking` (Pixels app); ip/ua are cleared after 30 days. */
    tracking: jsonb('tracking').$type<PixelTracking>(),
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
    /**
     * COD & RTO app: how likely this parcel is to come back (score 0 to 100, level and the
     * reasons), worked out at checkout or by "Score again". Null when the app was not installed.
     */
    rtoRisk: jsonb('rto_risk').$type<OrderRtoRisk>(),
    /**
     * COD & RTO app: the shopper's answer to the "confirm your cash on delivery order" link.
     * `pending` waits for it, `unconfirmed` is past the store's deadline (flagged for the
     * merchant), `confirmed` / `cancelled` is what the shopper (or the merchant by phone) said.
     */
    codVerification: text('cod_verification', {
      enum: ['pending', 'confirmed', 'cancelled', 'unconfirmed'],
    }),
    codVerifyRequestedAt: timestamp('cod_verify_requested_at', { withTimezone: true }),
    /** When the shopper answered, the merchant marked it, or the deadline flagged it. */
    codVerifiedAt: timestamp('cod_verified_at', { withTimezone: true }),
    /**
     * Markets. Every `*_paise` column above stays the shop currency (rupees): reports, GST and
     * profit read those. The presentment columns are what the shopper saw, in
     * `presentment_currency` minor units (cents; fils has 3 decimals), with the rate used
     * (`exchange_rate` = presentment units per rupee). Null on orders in the primary market.
     */
    marketId: uuid('market_id').references(() => market.id),
    presentmentCurrency: text('presentment_currency'),
    exchangeRate: numeric('exchange_rate', { precision: 18, scale: 8 }),
    presentmentSubtotalMinor: bigint('presentment_subtotal_minor', { mode: 'number' }),
    presentmentShippingMinor: bigint('presentment_shipping_minor', { mode: 'number' }),
    presentmentDiscountMinor: bigint('presentment_discount_minor', { mode: 'number' }),
    presentmentTaxMinor: bigint('presentment_tax_minor', { mode: 'number' }),
    presentmentTotalMinor: bigint('presentment_total_minor', { mode: 'number' }),
    /**
     * How GST applies: `domestic_gst` (CGST/SGST or IGST), `export_lut` (zero-rated export under
     * the store's LUT, no IGST) or `export_igst` (IGST paid, refunded later). Set at checkout
     * from the destination country.
     */
    taxRegime: text('tax_regime', { enum: ORDER_TAX_REGIMES }).notNull().default('domestic_gst'),
    /** Kept current by the `touch_updated_at` trigger (0177): what changed since, for syncs. */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /* Thank-you, pay and track pages find an order by its number. Unique per store (0177);
       numbers come from `store_counter`. */
    uniqueIndex('order_store_number').on(t.storeId, t.number),
    /** A draft is found by its #D number (search "D12"); one per store. */
    uniqueIndex('order_store_draft_number')
      .on(t.storeId, t.draftNumber)
      .where(sql`${t.draftNumber} is not null`),
    /** The All orders list: newest first. */
    index('order_store_placed').on(t.storeId, t.placedAt),
    index('order_customer').on(t.customerId).where(sql`${t.customerId} is not null`),
    check('order_tax_regime_check', sql`${t.taxRegime} in (${oneOf(ORDER_TAX_REGIMES)})`),
    /** The COD & RTO sweep reads orders still waiting for the shopper's answer. */
    index('order_cod_verification_open')
      .on(t.storeId, t.codVerifyRequestedAt)
      .where(sql`${t.codVerification} in ('pending', 'unconfirmed')`),
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

/** The COD & RTO app's score for one order (`order.rto_risk`). */
export type OrderRtoRisk = {
  score: number
  level: 'low' | 'medium' | 'high'
  /** Why, most points first: a code the admin words, and the points it added (or took off). */
  factors: { code: string; points: number }[]
  scoredAt: string
}

export type OrderImportMeta = {
  /** The source's order name, e.g. `#1001`. */
  name: string
  sourceId?: string | null
  financialStatus?: string | null
  fulfillmentStatus?: string | null
  paymentMethod?: string | null
  cancelledAt?: string | null
  refundedPaise?: number | null
  /**
   * Set when staff took an imported order that was still open over ("Manage this order in
   * Koomerce", `order/takeover.ts`): `imported_from` is cleared then, so the platform it came
   * from is kept here. From then on it is worked like an order placed here.
   */
  takenOver?: { at: string; by: string; source: string } | null
  /** The source's own order timeline (paid, emails sent, edits…), oldest first, as plain text. */
  history?: { at: string; message: string }[] | null
}

export const orderLine = pgTable(
  'order_line',
  {
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
    /** The pre-order note as it read when the order was placed (#936), for the email and order pages. */
    preorderNote: text('preorder_note'),
    /**
     * What one unit cost the store when it sold: the variant's weighted average cost
     * (`variant.cost_paise`, landed cost) at placement. Profit reads this, never today's cost.
     * Null when the variant had no cost.
     */
    costAtSalePaise: integer('cost_at_sale_paise'),
    /** The cost was filled in later from the variant's cost then, not snapshotted at sale (0105). */
    costEstimated: boolean('cost_estimated').notNull().default(false),
    /** Markets: one unit's price as the shopper saw it, in the order's presentment currency. */
    presentmentUnitPriceMinor: bigint('presentment_unit_price_minor', { mode: 'number' }),
  },
  (t) => [
    /* Every order page, invoice, parcel and profit report reads lines by order. */
    index('order_line_order').on(t.orderId),
    index('order_line_variant').on(t.variantId),
  ],
)

/**
 * SOURCE OF TRUTH: fulfillment_order, fulfillmentOrder, FULFILLMENT_ORDER_STATUSES
 * WHAT:  One parcel of an order: the goods one location sends, billed under that location's
 *        GSTIN. Every non-draft order with goods has at least one; gift card lines have none.
 * WHY:   Stock is held, packed and given back at a location, so each unit of an order needs
 *        to know which location holds it. Checkout may split an order into several parcels
 *        (fewest first, up to the store's limit), each from one warehouse under its GSTIN.
 * WHERE: @commerce/core fulfilment/routing.ts decides them; order/fulfillment-orders.ts creates
 *        them (placeOrder, draft conversion, `ensureFulfillmentOrders` for older orders) and
 *        moves their stock.
 *        `order_line.fulfilled_quantity` stays the order-level total the statuses read.
 */
export const FULFILLMENT_ORDER_STATUSES = ['open', 'on_hold', 'fulfilled', 'cancelled'] as const
export type FulfillmentOrderStatus = (typeof FULFILLMENT_ORDER_STATUSES)[number]

export const fulfillmentOrder = pgTable(
  'fulfillment_order',
  {
    id: id(),
    storeId: storeId(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id),
    /** Where the goods are held and leave from. */
    locationId: uuid('location_id')
      .notNull()
      .references(() => location.id),
    /** The GSTIN this parcel is billed under, as it was when the parcel was made. */
    gstRegistrationId: uuid('gst_registration_id').references(() => gstRegistration.id),
    /** Parcel 1, 2, ... within the order, in the order they were made. */
    position: integer('position').notNull().default(1),
    status: text('status', { enum: FULFILLMENT_ORDER_STATUSES }).notNull().default('open'),
    /**
     * No location could send the whole order within the store's parcel limit, so this parcel
     * holds more than its location has: the merchant moves stock in before packing.
     */
    needsTransfer: boolean('needs_transfer').notNull().default(false),
    /*
     * The parcel's share of the order's money (PARCEL_ALLOCATION in @commerce/core
     * tax/parcel-gst.ts): its goods, and the order discount, payment fee or discount and
     * shipping shared out by goods value. Shares add back to the order's totals exactly. Null on
     * parcels made without them (drafts, orders older than 0099 with more than one parcel).
     */
    subtotalPaise: integer('subtotal_paise'),
    discountPaise: integer('discount_paise'),
    adjustmentPaise: integer('adjustment_paise'),
    shippingPaise: integer('shipping_paise'),
    totalPaise: integer('total_paise'),
    /** GST inside `total_paise`, split from this parcel's GSTIN state (OrderGst). */
    taxPaise: integer('tax_paise'),
    taxBreakdown: jsonb('tax_breakdown'),
    /** Where this parcel's GST split was worked out from, as at checkout. */
    taxOrigin: jsonb('tax_origin').$type<OrderTaxOrigin>(),
    /**
     * When the shopper was told this parcel arrives (the courier's estimate from its location to
     * the address, at checkout): civil dates, `YYYY-MM-DD`. Null when none was worked out.
     */
    deliveryEstimate: jsonb('delivery_estimate').$type<ParcelDeliveryEstimate>(),
    /**
     * Fulfilment held (an automation's "Hold fulfilment", for a risky COD order, say): no
     * shipment is booked for this parcel until it is released. Separate from `status`, whose
     * `on_hold` means pre-order goods waiting for stock.
     */
    heldAt: timestamp('held_at', { withTimezone: true }),
    holdReason: text('hold_reason'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('fulfillment_order_position').on(t.orderId, t.position),
    index('fulfillment_order_store_order').on(t.storeId, t.orderId),
    index('fulfillment_order_store_location').on(t.storeId, t.locationId, t.status),
    check(
      'fulfillment_order_status_check',
      sql`${t.status} in (${oneOf(FULFILLMENT_ORDER_STATUSES)})`,
    ),
  ],
)

/** A parcel's promised delivery window, civil dates (`2026-10-18`). */
export type ParcelDeliveryEstimate = { earliest: string; latest: string }

/** How many units of one order line a fulfilment order holds, and how many it has packed. */
export const fulfillmentOrderLine = pgTable(
  'fulfillment_order_line',
  {
    id: id(),
    storeId: storeId(),
    fulfillmentOrderId: uuid('fulfillment_order_id')
      .notNull()
      .references(() => fulfillmentOrder.id, { onDelete: 'cascade' }),
    orderLineId: uuid('order_line_id')
      .notNull()
      .references(() => orderLine.id),
    quantity: integer('quantity').notNull(),
    fulfilledQuantity: integer('fulfilled_quantity').notNull().default(0),
  },
  (t) => [
    uniqueIndex('fulfillment_order_line_unique').on(t.fulfillmentOrderId, t.orderLineId),
    index('fulfillment_order_line_order_line').on(t.orderLineId),
    check('fulfillment_order_line_quantity_check', sql`${t.quantity} > 0`),
    check(
      'fulfillment_order_line_fulfilled_check',
      sql`${t.fulfilledQuantity} >= 0 and ${t.fulfilledQuantity} <= ${t.quantity}`,
    ),
  ],
)

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
    /**
     * What the gateway kept from this payment, GST included, when it reported it; null uses the
     * store's fee rate (core order/profit.ts). Never estimated: only the gateway's figure goes here.
     */
    feePaise: integer('fee_paise'),
    /** The GST inside `fee_paise` (input tax credit for a GST-registered store). */
    feeTaxPaise: integer('fee_tax_paise'),
    /**
     * How the shopper paid, as the gateway said (core `PaymentMethodDetailSchema`): UPI, card
     * type and network, international, corporate… Picks the fee rate until the fee is known.
     */
    methodDetail: jsonb('method_detail'),
    /** Last time the fee sync asked the gateway for this payment's fee; it waits before asking again. */
    feeCheckedAt: timestamp('fee_checked_at', { withTimezone: true }),
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
    /**
     * Markets: the currency the shopper paid in and the amount in its minor units, when not
     * rupees. `amount_paise` stays the rupee figure the store books.
     */
    currency: text('currency').notNull().default('INR'),
    amountMinor: bigint('amount_minor', { mode: 'number' }),
    createdAt: createdAt(),
    /** Kept current by the `touch_updated_at` trigger (0177). */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /* Confirmation and gateway webhooks find the attempt by the gateway's reference. */
    index('payment_provider_ref').on(t.providerRef),
    index('payment_order').on(t.orderId),
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
    /* The fee sync's queue: captured gateway payments whose fee is not known yet. */
    index('payment_fee_unknown')
      .on(t.createdAt)
      .where(
        sql`${t.feePaise} is null and ${t.providerPaymentId} is not null and ${t.status} in ('captured', 'refunded')`,
      ),
  ],
)

/**
 * Money returned to the shopper. Gateways process it themselves; COD and
 * manual transfers are settled outside the platform and recorded as `manual`.
 */
export const refund = pgTable(
  'refund',
  {
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
    /**
     * How a refund recorded by hand went back (`REFUND_METHODS`: UPI, bank transfer, cash, store
     * credit, …); null on gateway refunds and on manual ones recorded before this existed.
     */
    method: text('method'),
    /** The gift card issued when the refund went back as store credit. */
    giftCardId: uuid('gift_card_id').references(() => giftCard.id, { onDelete: 'set null' }),
    /** Markets: what went back in the payment's own currency, when not rupees. */
    currency: text('currency').notNull().default('INR'),
    amountMinor: bigint('amount_minor', { mode: 'number' }),
    createdAt: createdAt(),
    /** Kept current by the `touch_updated_at` trigger (0177). */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('refund_order').on(t.orderId), index('refund_payment').on(t.paymentId)],
)

/** Staff notes on an order; the timeline shows them beside system events. */
export const orderNote = pgTable(
  'order_note',
  {
    id: id(),
    storeId: storeId(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id),
    body: text('body').notNull(),
    /** Email of the staff member who wrote it. */
    author: text('author'),
    createdAt: createdAt(),
  },
  (t) => [index('order_note_order').on(t.orderId, t.createdAt)],
)

/** Staff actions on a customer (an opened WhatsApp chat); their Timeline shows them. */
export const customerNote = pgTable(
  'customer_note',
  {
    id: id(),
    storeId: storeId(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customer.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    /** Email of the staff member who did it. */
    author: text('author'),
    createdAt: createdAt(),
  },
  (t) => [index('customer_note_customer').on(t.customerId, t.createdAt)],
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
    /** The parcel (fulfilment order) this consignment carries; null on shipments booked before parcels. */
    fulfillmentOrderId: uuid('fulfillment_order_id').references(() => fulfillmentOrder.id),
    provider: text('provider').notNull(),
    waybill: text('waybill').notNull(),
    /** Courier's own id for follow-up calls when not the waybill (RapidShyp); else null. */
    providerRef: text('provider_ref'),
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
    pickupId: uuid('pickup_id').references(() => shipmentPickup.id, { onDelete: 'set null' }),
    /** What the courier charged for this consignment (from the booking, or typed by the merchant). */
    courierChargePaise: integer('courier_charge_paise'),
    packingCostPaise: integer('packing_cost_paise'), // packing snapshot when booked or packed
    boxPresetId: text('box_preset_id'),
    /** COD or prepaid as booked (the merchant can switch it from the order's own); null on older rows. */
    paymentMode: text('payment_mode', { enum: ['cod', 'prepaid'] }),
    /** What the courier collects at the door, as booked; 0 for prepaid, null on older rows. */
    codAmountPaise: integer('cod_amount_paise'),
    /** Where the courier collects it, as booked: its pickup location name, else the address name. */
    pickupLocationName: text('pickup_location_name'),
    /** The courier service booked ("Surface", "Express", an aggregator's carrier), when picked. */
    serviceLabel: text('service_label'),
    /** The carrier that delivers it ("Blue Dart" for a Shiprocket booking); null on older rows. */
    carrier: text('carrier'),
    /** When the courier's delivered scan landed; null until then (and on older rows). */
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('shipment_provider_waybill').on(t.provider, t.waybill),
    index('shipment_order').on(t.orderId),
    index('shipment_store_ndr').on(t.storeId, t.ndrStatus),
    index('shipment_pickup_id').on(t.pickupId),
    index('shipment_fulfillment_order').on(t.fulfillmentOrderId),
  ],
)

/**
 * An order sent to a courier app (Shiprocket, RapidShyp) as a pending order, without booking:
 * the merchant books it there or here later. One row per order and courier; booking here reuses
 * `externalOrderId`/`externalShipmentId` instead of creating a second order at the courier.
 * Rules: @commerce/core shipping/order-push.ts.
 */
export const courierOrder = pgTable(
  'courier_order',
  {
    id: id(),
    storeId: storeId(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    externalOrderId: text('external_order_id'),
    externalShipmentId: text('external_shipment_id'),
    status: text('status', { enum: ['pushed', 'failed', 'booked', 'cancelled'] }).notNull(),
    error: text('error'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('courier_order_order_provider').on(t.orderId, t.provider)],
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
    /** The courier pickup location (warehouse) asked to be collected from; null on older rows. */
    pickupLocationName: text('pickup_location_name'),
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

/**
 * A shipping profile: a set of products with their own zones and rates (Shopify's delivery
 * profiles). Every store has one General profile (`is_default`) holding every product not
 * placed in another profile; a product sits in at most one custom profile. A cart with
 * products from several profiles pays one rate per profile, summed (core `quoteProfiles`).
 */
export const shippingProfile = pgTable(
  'shipping_profile',
  {
    id: id(),
    storeId: storeId(),
    name: text('name').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('shipping_profile_one_default').on(t.storeId).where(sql`${t.isDefault}`),
    index('shipping_profile_store').on(t.storeId, t.position),
  ],
)

/** A product placed in a custom shipping profile; the General profile keeps no rows. */
export const shippingProfileProduct = pgTable(
  'shipping_profile_product',
  {
    id: id(),
    storeId: storeId(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => shippingProfile.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
  },
  (t) => [
    // One profile per product: adding it to another profile moves it.
    uniqueIndex('shipping_profile_product_unique').on(t.storeId, t.productId),
    index('shipping_profile_product_profile').on(t.profileId),
  ],
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
    /**
     * The shipping profile whose products these rates price. Null counts as the store's
     * General profile, so a zone written without one (seeds, older code) still applies.
     */
    profileId: uuid('profile_id').references(() => shippingProfile.id, { onDelete: 'cascade' }),
    /**
     * ISO 3166-1 countries the zone covers (Markets). `{IN}` is the zone as it always was;
     * `state_codes` and the PIN rules only narrow it inside India.
     */
    countryCodes: text('country_codes').array().notNull().default(['IN']),
    /** Two-letter state codes (`KA`, `MH`). */
    stateCodes: text('state_codes').array().notNull().default([]),
    pincodeRules: jsonb('pincode_rules').$type<ShippingPincodeRule[]>().notNull().default([]),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('shipping_zone_store').on(t.storeId, t.position),
    index('shipping_zone_profile').on(t.profileId),
  ],
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

/**
 * Where an order's GST was charged from. Prices include GST, so this only decides
 * CGST + SGST (same state as the shopper) or IGST (another state), never the price.
 * Rules: @commerce/core tax/origin.ts.
 */
export type OrderTaxOrigin = {
  /** `location`: the selling location's GSTIN; `default_registration`: the store's default
   *  GSTIN; `store_address`: no GSTIN at all, the state in Settings › General. */
  source: 'location' | 'default_registration' | 'store_address'
  locationId: string | null
  locationName: string | null
  gstRegistrationId: string | null
  gstin: string | null
  /** Two-letter state, e.g. 'HR'; null when nothing says where the seller is. */
  stateCode: string | null
  stateName: string | null
}

/** What the shopper picked at checkout, kept on the order as it was charged. */
export type OrderShippingProfilePart = {
  profileId: string
  profileName: string
  rateId: string
  rateName: string
  zoneId: string
  zoneName: string
  pricePaise: number
}

export type OrderShippingSnapshot = {
  /** The rate's id; rates from several shipping profiles join theirs with `+`. */
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
  /** A cart from several shipping profiles: the rate charged for each profile's products. */
  profiles?: OrderShippingProfilePart[] | undefined
  /** Delivery options app: the option and the exact route the price was quoted on. */
  delivery?: OrderDeliveryRoute | undefined
}

/**
 * The Delivery options app's thread from checkout to booking: Create shipment and bulk booking
 * book `route` through its own app, which issues the AWB and label and carries tracking. On a
 * delivery option order `rateId` is the option's id and `zoneId`/`zoneName` are empty unless
 * it was placed on backup (the zone rate charged).
 */
export type OrderDeliveryRoute = {
  optionId: string
  optionName: string
  /** Null when the order was placed on backup (couriers down): no route was saved. */
  route: {
    key: string
    providerId: string
    channel: 'direct' | 'aggregator'
    carrier: string
    serviceId: string
    serviceLabel: string
  } | null
  /** `strategy`, `rule:<id>`, `shopper` (a sub-choice) or `backup`. */
  pickedBy: string
  insured: boolean
  insurancePaise: number | null
  markupPaise: number
  /** What the route quoted, before markup and insurance. */
  courierCostPaise: number | null
  /** "YYYY-MM-DD". */
  promisedEarliest: string | null
  promisedLatest: string | null
  quoteSource: 'live' | 'cache' | 'backup'
}

export type DiscountKind = 'code' | 'automatic'
export type DiscountMethod = 'percent' | 'fixed' | 'free_shipping'
export type DiscountAppliesTo = 'all' | 'products' | 'collections'
export type DiscountStatus = 'active' | 'disabled'
/**
 * Shopify's four discount types plus combo deals; `method` still says what a products/order/bxgy
 * discount gives (a combo keeps its own discount on each combo).
 */
export type DiscountType = 'products' | 'order' | 'bxgy' | 'shipping' | 'combo'
export type DiscountEligibility = 'all' | 'segments' | 'customers'
/** Which other discount classes this one may stack with at checkout. */
export type DiscountCombinesWith = { products: boolean; order: boolean; shipping: boolean }
/**
 * Buy X get Y. The shopper buys `buys` (a quantity of items or an amount spent, from products
 * or collections) and gets `gets.quantity` items from `gets` at the discount's `method`/`value`
 * (percent 10000 = free), at most `maxUsesPerOrder` times per order (null = no cap).
 */
export type DiscountBxgy = {
  buys: {
    kind: 'quantity' | 'amount'
    quantity: number
    amountPaise: number
    appliesTo: 'products' | 'collections'
    ids: string[]
  }
  gets: { quantity: number; appliesTo: 'products' | 'collections'; ids: string[] }
  maxUsesPerOrder: number | null
}

/**
 * One combo of a combo deal: a set of products (any variant) or of exact variants, each with
 * the quantity the set needs, and what the full set costs or takes off. `value` is the combo
 * price in minor units for `price`, basis points for `percent`, minor units off for `fixed`.
 */
export type DiscountCombo = {
  scope: 'products' | 'variants'
  items: { id: string; quantity: number }[]
  method: 'price' | 'percent' | 'fixed'
  value: number
}

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
    type: text('type').$type<DiscountType>().notNull().default('order'),
    kind: text('kind').$type<DiscountKind>().notNull().default('code'),
    /** Upper-cased and trimmed; null for automatic discounts. */
    code: text('code'),
    method: text('method').$type<DiscountMethod>().notNull(),
    value: integer('value').notNull().default(0),
    minSubtotalPaise: integer('min_subtotal_paise'),
    /** Minimum number of items (eligible items for a products discount) in the cart. */
    minQuantity: integer('min_quantity'),
    appliesTo: text('applies_to').$type<DiscountAppliesTo>().notNull().default('all'),
    /** Product or collection ids when applies_to narrows the scope. */
    appliesToIds: jsonb('applies_to_ids').$type<string[]>().notNull().default([]),
    /**
     * A different amount for each product: `{ productId: value }`, value in the same unit
     * as `value` (basis points or paise), taken off every unit of that product. Only with
     * applies_to `products` and method `percent` or `fixed`; null means `value` applies.
     */
    productValues: jsonb('product_values').$type<Record<string, number>>(),
    /** Buy X get Y settings; only for type `bxgy`. */
    bxgy: jsonb('bxgy').$type<DiscountBxgy>(),
    /** Combo deal: Combo 1..N; only for type `combo`. */
    combos: jsonb('combos').$type<DiscountCombo[]>(),
    /** Free shipping only to these Indian state codes; empty means every state. */
    shippingStates: jsonb('shipping_states').$type<string[]>().notNull().default([]),
    /** Free shipping skips rates above this price; null means any rate. */
    maxShippingPaise: integer('max_shipping_paise'),
    customerEligibility: text('customer_eligibility')
      .$type<DiscountEligibility>()
      .notNull()
      .default('all'),
    /** Segment ids or customer ids, per `customer_eligibility`. */
    eligibleIds: jsonb('eligible_ids').$type<string[]>().notNull().default([]),
    combinesWith: jsonb('combines_with')
      .$type<DiscountCombinesWith>()
      .notNull()
      .default({ products: false, order: false, shipping: false }),
    usageLimit: integer('usage_limit'),
    usagePerCustomer: integer('usage_per_customer'),
    usedCount: integer('used_count').notNull().default(0),
    /** Markets the discount works in; empty means every market. Fixed amounts are converted. */
    marketIds: uuid('market_ids').array().notNull().default([]),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    status: text('status').$type<DiscountStatus>().notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('discount_store_code').on(t.storeId, t.code)],
)

/** One row per order that used a discount; drives usage limits and per-customer caps. */
export const discountUsage = pgTable(
  'discount_usage',
  {
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
  },
  (t) => [
    /* Every checkout with a code counts this shopper's uses (`customerUsageCount`). */
    index('discount_usage_discount_email').on(t.discountId, t.email),
    index('discount_usage_order').on(t.orderId),
  ],
)

export type DomainKind = 'platform' | 'custom'
export type DomainStatus = 'pending' | 'active' | 'failed'
export type DomainSslStatus = 'pending' | 'issuing' | 'active' | 'failed'
export type DomainRouteStatus = 'none' | 'pending' | 'ready' | 'failed'

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
    /**
     * The HTTPS route on the proxy (a Dokploy domain on the storefront app), added by the
     * worker once DNS is verified: `none` (not asked for, or routing is off), `pending`
     * (queued), `ready` (the proxy has it, the certificate follows), `failed` (gave up
     * after retries; the next poll asks again). See `domains/routes.ts`.
     */
    routeStatus: text('route_status').$type<DomainRouteStatus>().notNull().default('none'),
    /** When the route was last asked for, so a stuck request is asked again. */
    routeRequestedAt: timestamp('route_requested_at', { withTimezone: true }),
    /**
     * When the current wait for a certificate began: set when the route is first added and
     * again by "Retry certificate". The retry schedule counts from here (domains/certificate.ts).
     */
    sslStartedAt: timestamp('ssl_started_at', { withTimezone: true }),
    /** When the certificate was last looked at over TLS by the sweep (separate from the DNS poll's `lastCheckedAt`). */
    sslCheckedAt: timestamp('ssl_checked_at', { withTimezone: true }),
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
    check(
      'store_domain_route_status',
      sql`${t.routeStatus} in ('none', 'pending', 'ready', 'failed')`,
    ),
  ],
)

/**
 * A platform admin's invite for a new merchant to sign up and create their own
 * store (`bun run platform:invite <email>`). Distinct from `invitation`
 * (Better Auth, staff joining an existing store) - this is the signup gate for
 * `MERCHANT_SIGNUP_MODE=invite`. No store yet exists when this row is created,
 * so it carries no `store_id` and sits outside RLS like `store` itself.
 */
export const signupInvite = pgTable(
  'signup_invite',
  {
    id: id(),
    email: text('email').notNull(),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    /**
     * The paid plan order on the platform's sales store this invite came from; null for
     * invites issued by hand. A refund or cancellation of that order expires the invite
     * (security audit D-05). No foreign key: orders sit under store RLS, invites do not.
     */
    planOrderId: uuid('plan_order_id'),
    createdAt: createdAt(),
  },
  (t) => [
    // One live (unused) invite per email at a time; a fresh invite is issued
    // by first cancelling or letting the old one expire.
    uniqueIndex('signup_invite_email_unused').on(t.email).where(sql`used_at is null`),
    index('signup_invite_plan_order').on(t.planOrderId),
  ],
)

/**
 * People waiting for an invite while signups are invite-only
 * (MERCHANT_SIGNUP_MODE=invite). Platform-level like `signup_invite`: no
 * store_id, no RLS. One row per email; joining again updates it.
 */
export const signupWaitlist = pgTable('signup_waitlist', {
  id: id(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull(),
  /** Free text: what they sell, in their words. */
  sells: text('sells').notNull(),
  /** Better Auth user who joined, when signed in. */
  userId: text('user_id'),
  /** Set when a platform invite goes out for this email. */
  invitedAt: timestamp('invited_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

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
    /** Most checkouts that may spend this card (#993). Null: no limit. */
    usageLimit: integer('usage_limit'),
    /** Checkouts that have spent it, counted against `usage_limit`. */
    useCount: integer('use_count').notNull().default(0),
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
    index('gift_card_transaction_order').on(t.orderId).where(sql`${t.orderId} is not null`),
    check(
      'gift_card_transaction_kind',
      sql`${t.kind} in ('issue', 'debit', 'refund', 'adjustment')`,
    ),
  ],
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
 * "Needs approval" on a role: a member on this role who does an action needing `permission`
 * has it queued in Approvals (an `ai_action` row) for a different member to approve, from any
 * surface (admin, AI assistant, MCP, API). Kept apart from `role_permission` because the
 * built-in roles' grants are fixed and re-seeded, while the owner can change any role's ticks.
 */
export const roleApproval = pgTable(
  'role_approval',
  {
    id: id(),
    storeId: storeId(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(),
  },
  (t) => [uniqueIndex('role_approval_role_permission').on(t.roleId, t.permission)],
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
    /** Which metric sits in each Home analytics tile (`@commerce/core/home-metrics`); null = defaults. */
    homeTiles: jsonb('home_tiles'),
    /**
     * This member's own alerts for this store (Account → Notifications): which events reach
     * them by email or WhatsApp, the daily summary's hour and the day it last went. Null means
     * the defaults (`@commerce/core/member-account`, `parseMemberAlertPrefs`).
     */
    notificationPrefs: jsonb('notification_prefs'),
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

/** The range a saved report runs over: a preset (`30d`) or fixed `from`/`to` days. */
export type SavedReportRange = {
  key: 'today' | '7d' | '30d' | '90d' | 'custom'
  from?: string | undefined
  to?: string | undefined
}

/**
 * A report a merchant saved from Analytics → Reports under their own name: which report
 * (`report_slug`, from the catalogue) and the range it runs over. Store-wide, like the
 * catalogue; `created_by` is the staff user who saved it.
 */
export const savedReport = pgTable(
  'saved_report',
  {
    id: id(),
    storeId: storeId(),
    name: text('name').notNull(),
    reportSlug: text('report_slug').notNull(),
    range: jsonb('range').$type<SavedReportRange>().notNull(),
    /** A saved custom query (`report_slug` 'query'): its text, run through the query parser. */
    query: text('query'),
    createdBy: text('created_by'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('saved_report_store_created').on(t.storeId, t.createdAt)],
)
