/** SOURCE OF TRUTH: the Liquid page context — WHAT: what one request renders with: the request and render options, the Shopify globals (shop, settings, routes, request, localization, collections, linklists, cart...) and our routes and cart in Shopify's shape / WHY: every section on a page shares one context, so they all see the same data and cost one set of loads */

import { type EngineEntry, engineFor, type ThemeBundle } from './bundle'
import { LiquidDataCache } from './cache'
import { imageDrop, LIQUID_ROUTES, type LiquidCartData, type LiquidDataSource } from './drops'
import type { EngineRuntime } from './engine'
import { numericId } from './numeric-id'
import {
  AllProductsDrop,
  BlogsDrop,
  CollectionsDrop,
  LinklistsDrop,
  PagesDrop,
  ProductDrop,
} from './resource-drops'
import { liquidSettings } from './settings-values'

/** What a page render knows about the request. */
export type LiquidRequest = {
  /** `index`, `product`, `collection`... (Shopify's `template.name`). */
  template: string
  path: string
  host: string
  origin: string
  /** True in the editor canvas: themes show placeholders and skip some scripts. */
  designMode: boolean
  /** `?form_posted=<type>` after one of our form handlers redirected back. */
  postedForm: string | null
  /** CSP nonce for inline scripts on the storefront; blank in the editor. */
  nonce: string
}

export type LiquidRenderOptions = {
  bundle: ThemeBundle
  data: LiquidDataSource
  request: LiquidRequest
  /** `asset_url` base: `/theme-assets/<theme>` on the storefront, absolute in the editor. */
  assetBase: string
  /** The merchant's old Shopify host, for `file_url`. */
  shopifyHost: string | null
  /** Shopify `money_format` (theme import option); null formats with @commerce/money. */
  moneyFormat: string | null
  /** Payment marks the footer shows (`shop.enabled_payment_types`). */
  paymentTypes: string[]
}

/** One section placed in a template or group, as Puck data keeps it (see `liquid-data.ts`). */
export type LiquidSectionInput = {
  id: string
  type: string
  settings: Record<string, unknown>
  blocks: {
    id: string
    type: string
    settings: Record<string, unknown>
    disabled?: boolean | undefined
  }[]
  /** `template` or the group name, e.g. `header-group`. */
  location: string
  index: number
}

/** Theme settings (`settings`), typed by `settings_schema.json`; loads what they point at. */
async function themeSettingsFor(bundle: ThemeBundle, cache: LiquidDataCache) {
  const schema = bundle.settingsSchema.flatMap((g) => g.settings ?? [])
  let settings = liquidSettings(schema, bundle.settings, cache, bundle.settings)
  if (cache.missing) {
    await cache.fill()
    settings = liquidSettings(schema, bundle.settings, cache, bundle.settings)
  }
  return settings
}

/** The Shopify globals one request renders with, shared by every section on the page. */
export type LiquidPageContext = {
  bundle: ThemeBundle
  entry: EngineEntry
  globals: Record<string, unknown>
  runtime: EngineRuntime
  options: LiquidRenderOptions
  /** The request's data, read synchronously by renders (see `cache.ts`). */
  cache: LiquidDataCache
}

export async function createPageContext(options: LiquidRenderOptions): Promise<LiquidPageContext> {
  const { bundle, data, request } = options
  const entry = engineFor(bundle)
  const collectionList = await data.collections()
  const cart = await data.cart()
  const cache = new LiquidDataCache(data, collectionList)
  const settings = await themeSettingsFor(bundle, cache)
  const runtime: EngineRuntime = {
    assetUrl: (file) => {
      const clean = file.replace(/^\/+/, '')
      const sum = bundle.assets.get(clean)
      return `${options.assetBase}/${clean.split('/').map(encodeURIComponent).join('/')}${sum ? `?v=${sum}` : ''}`
    },
    assetText: bundle.assetText,
    locale: bundle.locale,
    currency: 'INR',
    moneyFormat: options.moneyFormat,
    fonts: new Map(),
    nonce: request.nonce,
    shopifyHost: options.shopifyHost,
    postedForm: request.postedForm,
  }
  const shop = data.shop
  const globals: Record<string, unknown> = {
    _rt: runtime,
    settings,
    shop: {
      name: shop.name,
      email: shop.email,
      phone: shop.phone,
      domain: shop.domain,
      permanent_domain: shop.domain,
      url: shop.url,
      secure_url: shop.url,
      currency: shop.currency,
      money_format: options.moneyFormat ?? '₹{{amount}}',
      money_with_currency_format: `${options.moneyFormat ?? '₹{{amount}}'} INR`,
      description: shop.description,
      locale: 'en',
      enabled_currencies: [{ iso_code: shop.currency, symbol: '₹' }],
      enabled_payment_types: options.paymentTypes,
      published_locales: [{ iso_code: 'en', name: 'English', primary: true }],
      policies: [],
      privacy_policy: { url: '/policies/privacy-policy', title: 'Privacy policy' },
      refund_policy: { url: '/policies/refund-policy', title: 'Refund policy' },
      shipping_policy: { url: '/policies/shipping-policy', title: 'Shipping policy' },
      terms_of_service: { url: '/policies/terms-of-service', title: 'Terms of service' },
      customer_accounts_enabled: true,
      customer_accounts_optional: true,
      types: [],
      vendors: [],
      metafields: {},
      brand: { logo: null, colors: {}, short_description: shop.description },
    },
    routes: LIQUID_ROUTES,
    request: {
      design_mode: request.designMode,
      visual_preview_mode: false,
      page_type: request.template,
      path: request.path,
      host: request.host,
      origin: request.origin,
      locale: { iso_code: 'en', name: 'English', primary: true, root_url: '/' },
    },
    localization: {
      language: { iso_code: 'en', name: 'English', endonym_name: 'English', root_url: '/' },
      country: {
        iso_code: 'IN',
        name: 'India',
        currency: { iso_code: 'INR', symbol: '₹', name: 'Indian Rupee' },
      },
      available_languages: [{ iso_code: 'en', name: 'English', endonym_name: 'English' }],
      available_countries: [
        { iso_code: 'IN', name: 'India', currency: { iso_code: 'INR', symbol: '₹' } },
      ],
    },
    template: { name: request.template, suffix: null, directory: null },
    theme: { id: bundle.themeId, name: 'Imported theme', role: 'main' },
    collections: new CollectionsDrop(cache),
    all_products: new AllProductsDrop(cache),
    linklists: new LinklistsDrop(cache),
    blogs: new BlogsDrop(cache),
    pages: new PagesDrop(cache),
    cart: cartDrop(cart),
    customer: null,
    content_for_header: '',
    content_for_index: '',
    powered_by_link: '',
    canonical_url: `${request.origin}${request.path}`,
    page_title: shop.name,
    page_description: shop.description,
    handle: '',
    current_page: 1,
    current_tags: [],
    search: { performed: false, results: [], results_count: 0, terms: '', types: [], filters: [] },
    predictive_search: { performed: false, resources: {}, terms: '' },
    recommendations: { performed: false, products: [], products_count: 0 },
    additional_checkout_buttons: false,
    images: {},
    scripts: null,
  }
  return { bundle, entry, globals, runtime, options, cache }
}

function cartDrop(cart: LiquidCartData): Record<string, unknown> {
  return {
    item_count: cart.itemCount,
    total_price: cart.totalPrice,
    items_subtotal_price: cart.totalPrice,
    original_total_price: cart.totalPrice,
    total_discount: 0,
    total_weight: 0,
    currency: { iso_code: 'INR', symbol: '₹' },
    note: '',
    attributes: {},
    cart_level_discount_applications: [],
    discount_applications: [],
    requires_shipping: cart.itemCount > 0,
    empty: cart.itemCount === 0,
    items: cart.items.map((i) => ({
      id: numericId(i.id),
      key: i.id,
      quantity: i.quantity,
      title: i.title,
      price: i.price,
      final_price: i.price,
      original_price: i.price,
      line_price: i.linePrice,
      final_line_price: i.linePrice,
      original_line_price: i.linePrice,
      variant_id: numericId(i.id),
      product: i.product ? new ProductDrop(i.product) : null,
      variant: { title: i.variantTitle },
      image: imageDrop(i.image),
      url: i.url,
      properties: {},
      discounts: [],
      line_level_discount_allocations: [],
      selling_plan_allocation: null,
      unit_price_measurement: null,
    })),
  }
}
