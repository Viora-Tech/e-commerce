/** SOURCE OF TRUTH: the Liquid page context — WHAT: what one request renders with: the request and render options, the Shopify globals (shop, settings, routes, request, localization, collections, linklists, metaobjects, cart...) and our routes and cart in Shopify's shape / WHY: every section on a page shares one context, so they all see the same data and cost one set of loads */

import { type EngineEntry, engineFor, type ThemeBundle, usesFileUrl } from './bundle'
import { LiquidDataCache } from './cache'
import { MetaobjectsDrop, ShopMetafieldsDrop } from './custom-drops'
import {
  imageDrop,
  type LiquidCartData,
  type LiquidDataSource,
  type LiquidPolicyData,
} from './drops'
import { type EngineRuntime, newRenderBudget, type RenderBudget } from './engine'
import { importedFileKey } from './filter-values'
import { DEFAULT_LIQUID_MARKET, type LiquidMarket, liquidLocalization } from './localization'
import { numericId } from './numeric-id'
import {
  AllProductsDrop,
  ArticleDrop,
  BlogDrop,
  BlogsDrop,
  CollectionDrop,
  CollectionsDrop,
  LinklistsDrop,
  type ListingQuery,
  PageDrop,
  PagesDrop,
  ProductDrop,
  SearchDrop,
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
  /** False when the Forms app is not installed (contact forms show a notice); default true. */
  formsAvailable?: boolean | undefined
  /** CSP nonce for inline scripts on the storefront; blank in the editor. */
  nonce: string
  /**
   * A collection or search page's listing params (`filter.*`, `sort_by`, `page`, `q`): the
   * page's `collection.products` / `collection.filters` and `search` follow them.
   */
  listing?: ListingQuery | undefined
  /**
   * The shopper's A/B test variations (the GrowthBook app): experiment tracking key → variation
   * number, 0 for the control. Themes read `request.experiments['hero-test']`; empty without.
   */
  experiments?: Readonly<Record<string, number>> | undefined
  /** The market and language the page renders in; India in English without one. */
  market?: LiquidMarket | undefined
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
/** One placed block; `blocks` are the theme blocks nested inside it (a tab's contents). */
export type LiquidBlockInput = {
  id: string
  type: string
  settings: Record<string, unknown>
  disabled?: boolean | undefined
  blocks?: LiquidBlockInput[] | undefined
}

export type LiquidSectionInput = {
  id: string
  type: string
  settings: Record<string, unknown>
  blocks: LiquidBlockInput[]
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

/**
 * The path of each resource page: `/products/<handle>`, `/collections/<handle>`, an article's
 * `/blogs/<blog>/<handle>` (the blog's handle is captured first).
 */
const RESOURCE_PATH = {
  product: /^\/products\/([^/?#]+)/,
  collection: /^\/collections\/([^/?#]+)/,
  page: /^\/pages\/([^/?#]+)/,
  blog: /^\/blogs\/([^/?#]+)/,
  article: /^\/blogs\/([^/?#]+)\/([^/?#]+)/,
} as const
type ResourceKind = keyof typeof RESOURCE_PATH

/**
 * The handle a resource page's path names (`/products/mouse?x=1` → `mouse`), with the blog's
 * for an article, or null.
 */
export function resourceHandle(
  template: string,
  path: string,
): { kind: ResourceKind; handle: string; blog?: string } | null {
  const kind = template.split('.')[0] as ResourceKind
  const pattern = RESOURCE_PATH[kind]
  if (!pattern) return null
  const m = pattern.exec(path)
  if (!m?.[1]) return null
  try {
    if (kind !== 'article') return { kind, handle: decodeURIComponent(m[1]) }
    if (!m[2]) return null
    return { kind, handle: decodeURIComponent(m[2]), blog: decodeURIComponent(m[1]) }
  } catch {
    return null
  }
}

/**
 * Shopify's `product`, `collection`, `page`, `blog` or `article` (with its `blog`) global on
 * that resource's page, so the theme's own sections around our main section (specs, size guide,
 * related products, an article's series…) read it. Loaded once here; null when the handle names
 * nothing.
 */
async function resourceGlobals(
  request: LiquidRequest,
  cache: LiquidDataCache,
): Promise<Record<string, unknown>> {
  const found = resourceHandle(request.template, request.path)
  if (!found) return {}
  const { kind, handle } = found
  if (kind === 'blog' || kind === 'article') return blogGlobals(kind, handle, found.blog, cache)
  const read = () =>
    kind === 'product'
      ? cache.product(handle)
      : kind === 'collection'
        ? cache.collection(handle)
        : cache.page(handle)
  let data = read()
  if (!data && cache.missing) {
    await cache.fill()
    data = read()
  }
  if (!data) return {}
  const drop =
    kind === 'product'
      ? new ProductDrop(data as NonNullable<ReturnType<LiquidDataCache['product']>>, cache)
      : kind === 'collection'
        ? new CollectionDrop(data as NonNullable<ReturnType<LiquidDataCache['collection']>>, cache)
        : new PageDrop(data as NonNullable<ReturnType<LiquidDataCache['page']>>)
  if (drop instanceof CollectionDrop && request.listing) drop.listOn(request.listing)
  return { [kind]: drop, handle, page_title: data.title }
}

/** `blog` on a blog's page; `blog` and `article` on an article's (among the blog's latest posts). */
async function blogGlobals(
  kind: 'blog' | 'article',
  handle: string,
  blogOfArticle: string | undefined,
  cache: LiquidDataCache,
): Promise<Record<string, unknown>> {
  const blogHandle = kind === 'blog' ? handle : (blogOfArticle ?? '')
  let b = cache.blog(blogHandle)
  if (!b && cache.missing) {
    await cache.fill()
    b = cache.blog(blogHandle)
  }
  if (!b) return {}
  if (kind === 'blog') return { blog: new BlogDrop(b), handle: b.handle, page_title: b.title }
  const a = b.articles.find((x) => x.handle === handle)
  if (!a) return { blog: new BlogDrop(b) }
  return {
    blog: new BlogDrop(b),
    article: new ArticleDrop(a),
    handle: a.handle,
    page_title: a.title,
  }
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
  /** Render time this page has used; every render is held to `LIQUID_LIMITS.pageMs` (engine.ts). */
  budget: RenderBudget
}

export async function createPageContext(options: LiquidRenderOptions): Promise<LiquidPageContext> {
  const { bundle, data, request } = options
  const entry = engineFor(bundle)
  const collectionList = await data.collections()
  const cart = await data.cart()
  const cache = new LiquidDataCache(data, collectionList)
  const settings = await themeSettingsFor(bundle, cache)
  const resource = await resourceGlobals(request, cache)
  const importedFiles = usesFileUrl(bundle) ? await data.importedFiles?.() : undefined
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
    ...(importedFiles
      ? { importedFileUrl: (name: string) => importedFiles.get(importedFileKey(name)) ?? null }
      : {}),
    postedForm: request.postedForm,
    formsAvailable: request.formsAvailable ?? true,
  }
  const shop = data.shop
  // Content entries (metaobjects): the `metaobjects` global and `shop.metaobjects` are one object.
  const metaobjects = new MetaobjectsDrop(cache)
  // The page's market and language: `localization`, `request.locale` and `routes`.
  const loc = liquidLocalization(request.market ?? DEFAULT_LIQUID_MARKET, shop.currency)
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
      locale: loc.locale.iso_code,
      enabled_currencies: [{ iso_code: shop.currency, symbol: '₹' }],
      enabled_payment_types: options.paymentTypes,
      published_locales: loc.publishedLocales,
      ...shopPolicies(shop.policies),
      customer_accounts_enabled: true,
      customer_accounts_optional: true,
      types: [],
      vendors: [],
      // Extra fields live on products and collections only; the shop's read blank, except
      // the Reviews app's Judge.me data.
      metafields: new ShopMetafieldsDrop(cache),
      metaobjects,
      brand: { logo: null, colors: {}, short_description: shop.description },
    },
    routes: loc.routes,
    request: {
      design_mode: request.designMode,
      visual_preview_mode: false,
      page_type: request.template,
      path: request.path,
      host: request.host,
      origin: request.origin,
      locale: loc.locale,
      experiments: { ...request.experiments },
    },
    localization: loc.localization,
    template: { name: request.template, suffix: null, directory: null },
    theme: { id: bundle.themeId, name: 'Imported theme', role: 'main' },
    collections: new CollectionsDrop(cache),
    all_products: new AllProductsDrop(cache),
    linklists: new LinklistsDrop(cache),
    blogs: new BlogsDrop(cache),
    pages: new PagesDrop(cache),
    metaobjects,
    cart: cartDrop(cart, cache),
    customer: null,
    content_for_header: '',
    content_for_index: '',
    // Shopify prints "Powered by Shopify" here; our own storefront shows no platform credit.
    powered_by_link: '',
    canonical_url: `${request.origin}${request.path}`,
    page_title: shop.name,
    page_description: shop.description,
    handle: '',
    current_page: 1,
    current_tags: [],
    search: new SearchDrop(cache, request.template === 'search' ? (request.listing ?? {}) : null),
    predictive_search: { performed: false, resources: {}, terms: '' },
    recommendations: { performed: false, products: [], products_count: 0 },
    additional_checkout_buttons: false,
    images: {},
    scripts: null,
    ...resource,
  }
  return { bundle, entry, globals, runtime, options, cache, budget: newRenderBudget() }
}

/** Shopify's `policy` object: `id`, `title`, `url` (our `/policies/<type>` page). */
function policyDrop(p: LiquidPolicyData) {
  return { id: p.type, handle: p.type, title: p.title, url: p.url }
}

/**
 * `shop.policies` (the published ones, footer order) and `shop.privacy_policy`,
 * `refund_policy`, `shipping_policy`, `terms_of_service`, `contact_information`: each the
 * published policy or nil, as on Shopify, so a theme never links a page that 404s.
 */
function shopPolicies(policies: LiquidPolicyData[]): Record<string, unknown> {
  const of = (type: string) => {
    const found = policies.find((p) => p.type === type)
    return found ? policyDrop(found) : null
  }
  return {
    policies: policies.map(policyDrop),
    privacy_policy: of('privacy-policy'),
    refund_policy: of('refund-policy'),
    shipping_policy: of('shipping-policy'),
    terms_of_service: of('terms-of-service'),
    contact_information: of('contact-information'),
  }
}

function cartDrop(cart: LiquidCartData, cache: LiquidDataCache): Record<string, unknown> {
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
      product: i.product ? new ProductDrop(i.product, cache) : null,
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
