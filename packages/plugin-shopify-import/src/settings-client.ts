/**
 * Store settings import: the parts a merchant can bring over from Shopify (store details,
 * tax, locations, shipping, packages, policies, extra field definitions), and the plan and
 * report shapes the admin shows. Pure: no database, no Node APIs, so the admin can import it
 * through `@commerce/plugin-shopify-import/client`. Every line carries codes, never English,
 * so the admin says it in the merchant's language.
 */
import type { ScopeHandle } from './client'

/** What "Store settings" can bring over, in the order an import writes them. */
export const SETTINGS_PARTS = [
  'store',
  'tax',
  'locations',
  'shipping',
  'packages',
  'policies',
  'fields',
] as const
export type SettingsPart = (typeof SETTINGS_PARTS)[number]

/** The Shopify scopes each part is read with; a missing one asks to reconnect for that part only. */
export const SETTINGS_PART_SCOPES: Record<SettingsPart, ScopeHandle[]> = {
  store: [],
  tax: [],
  // Shopify lets read_locations or read_inventory read locations; the importer already asks for the second.
  locations: ['read_inventory'],
  shipping: ['read_shipping'],
  packages: [],
  policies: ['read_legal_policies'],
  fields: ['read_products'],
}

/** What one line of the plan is about. */
const SETTINGS_SUBJECTS = [
  'store_name',
  'contact_email',
  'contact_phone',
  'address',
  'default_location_address',
  'currency',
  'timezone',
  'weight_unit',
  'money_format',
  'prices_include_tax',
  'gstin',
  'location',
  'shipping_zone',
  'delivery_profile',
  'packages',
  'policy',
  'field',
] as const
export type SettingsSubject = (typeof SETTINGS_SUBJECTS)[number]

/**
 * Why a line is a warning, a conflict, or left for the merchant to set up by hand.
 * `detail` on the line carries the Shopify value it is about (a currency, a carrier name…).
 */
const SETTINGS_REASONS = [
  /** Shopify sells in another currency; prices here stay in rupees and nothing is converted. */
  'currency_mismatch',
  /** Shopify's time zone differs; this store keeps its own (change it in Settings › General). */
  'timezone_mismatch',
  /** Shopify weighs in pounds or ounces; weights here are grams (products were converted on import). */
  'weight_unit',
  /** Shopify does not share the GST number with apps. */
  'gstin_not_shared',
  /** This store already has a GST number; the one from Shopify was not added over it. */
  'gstin_exists',
  'invalid_email',
  'invalid_phone',
  /** Not a 6-digit Indian PIN code; the address came over without it. */
  'invalid_pincode',
  /** Shopify's first shipping location is a different location from this store's default one. */
  'default_location',
  /** A location run by an app (a fulfilment service), not a place the merchant ships from. */
  'app_location',
  /** In-store pickup at a location: not available here yet. */
  'local_pickup',
  /** A shipping zone with no Indian states in it. */
  'zone_outside_india',
  /** A zone that also covers other countries; only its Indian part came over. */
  'zone_other_countries',
  /** A zone whose rates could not be brought over, so it was not created. */
  'zone_no_rates',
  /** A Shopify region name that is not an Indian state here. */
  'unknown_state',
  /** A shipping profile for some products only; rates here apply to every product. */
  'product_profile',
  /** Rates calculated live by a carrier or app. */
  'carrier_rates',
  /** A rate limited by order value and weight at once. */
  'mixed_conditions',
  /** A rate in another currency. */
  'rate_currency',
  /** Shopify does not share saved packages with apps. */
  'packages_not_shared',
  /** A Shopify policy kind with no page here (legal notice, terms of sale, subscriptions). */
  'policy_type',
  /** Pictures inside a policy were left out. */
  'policy_images',
  /** A field type with no match here (money, rating, JSON…). */
  'field_type',
  /** A link to entries of a content type that was not imported. */
  'reference_target',
  /** A field with the same key already exists here as another type. */
  'field_exists',
  /** The connection may not read one kind of extra field (customers or orders). */
  'owner_access',
] as const
export type SettingsReason = (typeof SETTINGS_REASONS)[number]

/**
 * `create`/`update`: what the import changes. `same`: already matches. `conflict`: this
 * store's value is kept and Shopify's is not written. `manual`: set it up by hand. `warn`:
 * a difference that is reported, never changed.
 */
export type SettingsAction = 'create' | 'update' | 'same' | 'conflict' | 'manual' | 'warn'

/** One shipping rate as the plan shows it. Money is paise, weight grams, `max` excluded. */
export type SettingsRatePreview = {
  name: string
  condition: 'none' | 'order_value' | 'weight'
  min: number | null
  max: number | null
  pricePaise: number
}

export type SettingsItem = {
  action: SettingsAction
  subject: SettingsSubject
  /** The record the line is about: a location, zone, policy or field. */
  name?: string | undefined
  /** Extra fields: what they belong to (`product`, `variant`, `collection`, `customer`, `order`). */
  owner?: string | undefined
  /** This store's value now, and Shopify's (what it becomes on `create`/`update`). */
  from?: string | null | undefined
  to?: string | null | undefined
  reason?: SettingsReason | undefined
  detail?: string | undefined
  /** Shipping zones: the rates it gets. */
  rates?: SettingsRatePreview[] | undefined
}

/**
 * `ready`: something to change. `same`: nothing to change (it may still carry notes).
 * `access`: the connection lacks a scope; reconnect to grant it. `failed`: Shopify or
 * the save gave an error (`error`).
 */
export type SettingsPartState = 'ready' | 'same' | 'access' | 'failed'

export type SettingsPartPlan = {
  part: SettingsPart
  state: SettingsPartState
  items: SettingsItem[]
  missingScopes?: ScopeHandle[] | undefined
  error?: string | undefined
}

export type SettingsPlan = { shopName: string; parts: SettingsPartPlan[] }

/** `done`: changes saved; `skipped`: not chosen. The others as in {@link SettingsPartState}. */
export type SettingsResultState = 'done' | 'same' | 'access' | 'failed' | 'skipped'

export type SettingsPartResult = {
  part: SettingsPart
  state: SettingsResultState
  /** Lines created or updated. */
  applied: number
  items: SettingsItem[]
  missingScopes?: ScopeHandle[] | undefined
  error?: string | undefined
}

/** True when a line changes something here. */
export const changes = (item: Pick<SettingsItem, 'action'>): boolean =>
  item.action === 'create' || item.action === 'update'
