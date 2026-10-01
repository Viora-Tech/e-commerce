/** SOURCE OF TRUTH: our data in Shopify's Liquid object shapes — WHAT: the plain data an imported theme reads (`LiquidData*` types the store loader fills) and the Liquid drops that present it as Shopify's `product`, `collection`, `image`, `linklist`, `cart`, `shop`... objects / WHY: a theme's markup reads Shopify's objects; mapping our records onto those shapes in one place is what lets a theme LOOK the same while every value comes from our own catalogue, menus and cart */
import { Drop } from 'liquidjs'
import type { LiquidDataCache } from './cache'

/** An image we host: product media, a section image, a collection image. */
export type LiquidImageData = {
  url: string
  alt?: string | null | undefined
  width?: number | null | undefined
  height?: number | null | undefined
  id?: string | undefined
}

export type LiquidVariantData = {
  id: string
  title: string
  /** Paise, as Shopify's subunit amounts. */
  price: number
  compareAtPrice: number | null
  available: boolean
  inventoryQuantity: number
  sku: string | null
  barcode: string | null
  options: string[]
  image: LiquidImageData | null
  weightGrams: number | null
}

export type LiquidProductData = {
  id: string
  handle: string
  title: string
  descriptionHtml: string
  vendor: string
  type: string
  tags: string[]
  images: LiquidImageData[]
  variants: LiquidVariantData[]
  options: { name: string; values: string[] }[]
  createdAt: Date
  /** Sold under our pre-order rules; shown to the theme as a "Pre-order" selling plan group. */
  preorder: boolean
}

export type LiquidCollectionData = {
  id: string
  handle: string
  title: string
  descriptionHtml: string
  image: LiquidImageData | null
  productsCount: number
}

export type LiquidLinkData = {
  title: string
  url: string
  type: string
  handle?: string | undefined
  links: LiquidLinkData[]
}

export type LiquidMenuData = { handle: string; title: string; links: LiquidLinkData[] }

export type LiquidArticleData = {
  id: string
  handle: string
  title: string
  url: string
  author: string
  excerptHtml: string
  contentHtml: string
  image: LiquidImageData | null
  tags: string[]
  publishedAt: Date | null
}

export type LiquidBlogData = {
  id: string
  handle: string
  title: string
  url: string
  articles: LiquidArticleData[]
}

export type LiquidPageData = { id: string; handle: string; title: string; contentHtml: string }

export type LiquidCartData = {
  itemCount: number
  totalPrice: number
  items: {
    id: string
    quantity: number
    title: string
    price: number
    linePrice: number
    product: LiquidProductData | null
    variantTitle: string
    image: LiquidImageData | null
    url: string
  }[]
}

export type LiquidShopData = {
  name: string
  email: string
  phone: string
  /** The host shoppers use, e.g. `waimers.in`. */
  domain: string
  /** `https://waimers.in`. */
  url: string
  currency: string
  description: string
}

/**
 * Everything a render can ask our store for. Each call is per request; the store
 * loader caches within one request, so a header and a footer asking for the same
 * menu cost one query.
 */
export type LiquidDataSource = {
  shop: LiquidShopData
  product(handle: string): Promise<LiquidProductData | null>
  collection(handle: string): Promise<LiquidCollectionData | null>
  /** A collection's products in its own order, the first `limit` of them. */
  collectionProducts(handle: string, limit: number): Promise<LiquidProductData[]>
  collections(): Promise<LiquidCollectionData[]>
  menu(handle: string): Promise<LiquidMenuData | null>
  blog(handle: string): Promise<LiquidBlogData | null>
  page(handle: string): Promise<LiquidPageData | null>
  cart(): Promise<LiquidCartData>
}

/** Shopify's handleize: lowercase, words joined by hyphens. */
export const handleize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export class ImageDrop extends Drop {
  readonly src: string
  readonly url: string
  readonly alt: string
  readonly width: number
  readonly height: number
  readonly aspect_ratio: number
  readonly id: string
  readonly media_type = 'image'
  readonly presentation = { focal_point: '50.0% 50.0%' }
  constructor(image: LiquidImageData) {
    super()
    this.src = image.url
    this.url = image.url
    this.alt = image.alt ?? ''
    // Unknown sizes read as square, so `aspect_ratio` maths never divides by zero.
    this.width = image.width ?? 1600
    this.height = image.height ?? image.width ?? 1600
    this.aspect_ratio = this.width / this.height
    this.id = image.id ?? image.url
  }
  get preview_image(): ImageDrop {
    return this
  }
  override valueOf(): string {
    return this.src
  }
  override toString(): string {
    return this.src
  }
}

export const imageDrop = (image: LiquidImageData | null | undefined): ImageDrop | null =>
  image?.url ? new ImageDrop(image) : null

/** A theme colour setting: prints as its hex, reads like Shopify's colour object. */
export class ColorDrop extends Drop {
  readonly hex: string
  readonly red: number
  readonly green: number
  readonly blue: number
  readonly alpha: number
  readonly rgb: string
  readonly rgba: string
  constructor(value: string) {
    super()
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value.trim())
    const hex6 = m?.[1]
      ? m[1].length === 3
        ? m[1]
            .split('')
            .map((c) => c + c)
            .join('')
        : m[1]
      : '000000'
    this.hex = `#${hex6}`
    this.red = Number.parseInt(hex6.slice(0, 2), 16)
    this.green = Number.parseInt(hex6.slice(2, 4), 16)
    this.blue = Number.parseInt(hex6.slice(4, 6), 16)
    this.alpha = m?.[2] ? Number.parseInt(m[2], 16) / 255 : 1
    this.rgb = `${this.red} ${this.green} ${this.blue}`
    this.rgba = `${this.red} ${this.green} ${this.blue} / ${this.alpha}`
  }
  override valueOf(): string {
    return this.hex
  }
  override toString(): string {
    return this.hex
  }
}

/** A colour scheme (`color_scheme` setting): its id prints, its settings read as colours. */
export class ColorSchemeDrop extends Drop {
  readonly id: string
  readonly settings: Record<string, unknown>
  constructor(id: string, settings: Record<string, unknown>) {
    super()
    this.id = id
    this.settings = settings
  }
  override valueOf(): string {
    return this.id
  }
}

/** A theme font (`font_picker`): Shopify font library handles like `inter_n7`. */
export class FontDrop extends Drop {
  readonly family: string
  readonly fallback_families: string
  readonly weight: number
  readonly style: string
  readonly variants: FontDrop[] = []
  readonly system: boolean
  readonly handle: string
  constructor(handle: string) {
    super()
    this.handle = handle
    const m = /^(.+)_([nio])(\d)$/.exec(handle)
    const name = m?.[1] ?? handle
    this.system = name.startsWith('system') || name === 'sans-serif' || name === 'serif'
    this.family = this.system
      ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      : name
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
    this.fallback_families = name.includes('serif') && !name.includes('sans') ? 'serif' : 'sans-serif'
    this.weight = Number(m?.[3] ?? 4) * 100
    this.style = m?.[2] === 'i' ? 'italic' : m?.[2] === 'o' ? 'oblique' : 'normal'
  }
  /** Liquid reads `font.system?` as a property named with a question mark. */
  override liquidMethodMissing(key: string): unknown {
    if (key === 'system?') return this.system
    return undefined
  }
  override valueOf(): string {
    return this.handle
  }
}

export class VariantDrop extends Drop {
  readonly id: string
  readonly title: string
  readonly name: string
  readonly price: number
  readonly compare_at_price: number | null
  readonly available: boolean
  readonly inventory_quantity: number
  readonly inventory_management: string
  readonly inventory_policy = 'deny'
  readonly sku: string
  readonly barcode: string
  readonly options: string[]
  readonly option1: string | null
  readonly option2: string | null
  readonly option3: string | null
  readonly image: ImageDrop | null
  readonly featured_image: ImageDrop | null
  readonly featured_media: ImageDrop | null
  readonly weight: number
  readonly requires_shipping = true
  readonly taxable = true
  readonly url: string
  readonly unit_price_measurement = null
  readonly selling_plan_allocations: unknown[] = []
  readonly quantity_rule = { min: 1, max: null, increment: 1 }
  readonly metafields: MetafieldsDrop
  readonly incoming = false
  readonly matched = true
  readonly selected = false
  constructor(v: LiquidVariantData, productUrl: string) {
    super()
    this.id = v.id
    this.title = v.title
    this.name = v.title
    this.price = v.price
    this.compare_at_price = v.compareAtPrice
    this.available = v.available
    this.inventory_quantity = v.inventoryQuantity
    this.inventory_management = 'shopify'
    this.sku = v.sku ?? ''
    this.barcode = v.barcode ?? ''
    this.options = v.options
    this.option1 = v.options[0] ?? null
    this.option2 = v.options[1] ?? null
    this.option3 = v.options[2] ?? null
    this.image = imageDrop(v.image)
    this.featured_image = this.image
    this.featured_media = this.image
    this.weight = v.weightGrams ?? 0
    this.url = `${productUrl}?variant=${v.id}`
    this.metafields = new MetafieldsDrop()
  }
}

/** Metafields: we have none under Shopify's namespaces, so every lookup is blank. */
export class MetafieldsDrop extends Drop {
  override liquidMethodMissing(): unknown {
    return new BlankNamespaceDrop()
  }
}

class BlankNamespaceDrop extends Drop {
  override liquidMethodMissing(): unknown {
    return null
  }
  override valueOf(): string {
    return ''
  }
}

const minOf = (xs: number[]) => (xs.length ? Math.min(...xs) : 0)
const maxOf = (xs: number[]) => (xs.length ? Math.max(...xs) : 0)

export class ProductDrop extends Drop {
  readonly id: string
  readonly handle: string
  readonly title: string
  readonly url: string
  readonly description: string
  readonly content: string
  readonly vendor: string
  readonly type: string
  readonly tags: string[]
  readonly images: ImageDrop[]
  readonly media: ImageDrop[]
  readonly featured_image: ImageDrop | null
  readonly featured_media: ImageDrop | null
  readonly variants: VariantDrop[]
  readonly options: string[]
  readonly options_with_values: { name: string; position: number; values: string[]; selected_value: string | null }[]
  readonly price: number
  readonly price_min: number
  readonly price_max: number
  readonly price_varies: boolean
  readonly compare_at_price: number | null
  readonly compare_at_price_min: number
  readonly compare_at_price_max: number
  readonly compare_at_price_varies: boolean
  readonly available: boolean
  readonly has_only_default_variant: boolean
  readonly first_available_variant: VariantDrop | null
  readonly selected_variant = null
  readonly selected_or_first_available_variant: VariantDrop | null
  readonly created_at: Date
  readonly published_at: Date
  readonly metafields = new MetafieldsDrop()
  readonly collections: unknown[] = []
  readonly gift_card = false
  readonly requires_selling_plan = false
  readonly selling_plan_groups: { id: string; name: string; app_id: string; selling_plans: unknown[] }[]
  readonly template_suffix = ''
  readonly quantity_price_breaks_configured = false
  constructor(p: LiquidProductData) {
    super()
    // Pre-order apps on Shopify mark products with a selling plan group; ours is built in.
    this.selling_plan_groups = p.preorder
      ? [{ id: 'preorder', name: 'Pre-order', app_id: 'commerce', selling_plans: [] }]
      : []
    this.id = p.id
    this.handle = p.handle
    this.title = p.title
    this.url = `/products/${p.handle}`
    this.description = p.descriptionHtml
    this.content = p.descriptionHtml
    this.vendor = p.vendor
    this.type = p.type
    this.tags = p.tags
    this.images = p.images.map((i) => new ImageDrop(i))
    this.media = this.images
    this.featured_image = this.images[0] ?? null
    this.featured_media = this.featured_image
    this.variants = p.variants.map((v) => new VariantDrop(v, this.url))
    this.options = p.options.map((o) => o.name)
    this.options_with_values = p.options.map((o, i) => ({
      name: o.name,
      position: i + 1,
      values: o.values,
      selected_value: o.values[0] ?? null,
    }))
    const prices = p.variants.map((v) => v.price)
    const compares = p.variants.map((v) => v.compareAtPrice ?? 0)
    this.price_min = minOf(prices)
    this.price_max = maxOf(prices)
    this.price = this.price_min
    this.price_varies = this.price_min !== this.price_max
    this.compare_at_price_min = minOf(compares)
    this.compare_at_price_max = maxOf(compares)
    this.compare_at_price = this.compare_at_price_max || null
    this.compare_at_price_varies = this.compare_at_price_min !== this.compare_at_price_max
    this.first_available_variant = this.variants.find((v) => v.available) ?? this.variants[0] ?? null
    this.selected_or_first_available_variant = this.first_available_variant
    this.available = this.variants.some((v) => v.available)
    this.has_only_default_variant =
      p.variants.length <= 1 && (p.options.length === 0 || p.options[0]?.name === 'Title')
    this.created_at = p.createdAt
    this.published_at = p.createdAt
  }
  get options_by_name(): Record<string, unknown> {
    return Object.fromEntries(this.options_with_values.map((o) => [o.name.toLowerCase(), o]))
  }
}

/**
 * A collection. `products` reads from the request's data cache (`cache.ts`): the first
 * render pass notes which collections it needs, the next one has them.
 */
export class CollectionDrop extends Drop {
  readonly id: string
  readonly handle: string
  readonly title: string
  readonly url: string
  readonly description: string
  readonly image: ImageDrop | null
  readonly products_count: number
  readonly all_products_count: number
  readonly metafields = new MetafieldsDrop()
  readonly filters: unknown[] = []
  readonly sort_by = ''
  readonly default_sort_by = 'manual'
  readonly template_suffix = ''
  readonly #cache: LiquidDataCache
  #products: ProductDrop[] | null = null
  constructor(c: LiquidCollectionData, cache: LiquidDataCache) {
    super()
    this.#cache = cache
    this.id = c.id
    this.handle = c.handle
    this.title = c.title
    this.url = `/collections/${c.handle}`
    this.description = c.descriptionHtml
    this.image = imageDrop(c.image)
    this.products_count = c.productsCount
    this.all_products_count = c.productsCount
  }
  get products(): ProductDrop[] {
    if (this.#products) return this.#products
    const list = this.#cache.collectionProducts(this.handle)
    if (!list) return []
    this.#products = list.map((p) => new ProductDrop(p))
    return this.#products
  }
  get featured_image(): ImageDrop | null {
    return this.image ?? this.products[0]?.featured_image ?? null
  }
  get all_tags(): string[] {
    return [...new Set(this.products.flatMap((p) => p.tags))].sort()
  }
  get all_types(): string[] {
    return [...new Set(this.products.map((p) => p.type).filter(Boolean))].sort()
  }
  get all_vendors(): string[] {
    return [...new Set(this.products.map((p) => p.vendor).filter(Boolean))].sort()
  }
}

/** `collections['handle']` and `{% for c in collections %}`. */
export class CollectionsDrop extends Drop {
  readonly #cache: LiquidDataCache
  readonly #drops = new Map<string, CollectionDrop>()
  constructor(cache: LiquidDataCache) {
    super()
    this.#cache = cache
  }
  #drop(c: LiquidCollectionData): CollectionDrop {
    const hit = this.#drops.get(c.handle)
    if (hit) return hit
    const drop = new CollectionDrop(c, this.#cache)
    this.#drops.set(c.handle, drop)
    return drop
  }
  override liquidMethodMissing(handle: string): unknown {
    if (handle === 'size') return this.#cache.collectionList.length
    const found = this.#cache.collection(handle)
    return found ? this.#drop(found) : null
  }
  override valueOf(): CollectionDrop[] {
    return this.#cache.collectionList.map((c) => this.#drop(c))
  }
}

/** `all_products['handle']`. */
export class AllProductsDrop extends Drop {
  readonly #cache: LiquidDataCache
  constructor(cache: LiquidDataCache) {
    super()
    this.#cache = cache
  }
  override liquidMethodMissing(handle: string): unknown {
    const found = this.#cache.product(handle)
    return found ? new ProductDrop(found) : null
  }
}

export class LinkDrop extends Drop {
  readonly title: string
  readonly url: string
  readonly type: string
  readonly handle: string
  readonly links: LinkDrop[]
  readonly levels: number
  readonly active = false
  readonly current = false
  readonly child_active = false
  readonly child_current = false
  readonly object = null
  constructor(link: LiquidLinkData) {
    super()
    this.title = link.title
    this.url = link.url
    this.type = link.type
    this.handle = link.handle ?? handleize(link.title)
    this.links = link.links.map((l) => new LinkDrop(l))
    this.levels = this.links.length ? 1 + Math.max(...this.links.map((l) => l.levels)) : 0
  }
}

export class LinklistDrop extends Drop {
  readonly handle: string
  readonly title: string
  readonly links: LinkDrop[]
  readonly levels: number
  constructor(menu: LiquidMenuData) {
    super()
    this.handle = menu.handle
    this.title = menu.title
    this.links = menu.links.map((l) => new LinkDrop(l))
    this.levels = this.links.length ? 1 + Math.max(...this.links.map((l) => l.levels)) : 0
  }
  override valueOf(): string {
    return this.handle
  }
}

/** `linklists['main-menu']`. */
export class LinklistsDrop extends Drop {
  readonly #cache: LiquidDataCache
  constructor(cache: LiquidDataCache) {
    super()
    this.#cache = cache
  }
  override liquidMethodMissing(handle: string): unknown {
    const menu = this.#cache.menu(handle)
    return menu ? new LinklistDrop(menu) : null
  }
}

export class ArticleDrop extends Drop {
  readonly id: string
  readonly handle: string
  readonly title: string
  readonly url: string
  readonly author: string
  readonly excerpt: string
  readonly excerpt_or_content: string
  readonly content: string
  readonly image: ImageDrop | null
  readonly tags: string[]
  readonly published_at: Date | null
  readonly created_at: Date | null
  readonly comments_count = 0
  readonly comments: unknown[] = []
  readonly metafields = new MetafieldsDrop()
  constructor(a: LiquidArticleData) {
    super()
    this.id = a.id
    this.handle = a.handle
    this.title = a.title
    this.url = a.url
    this.author = a.author
    this.excerpt = a.excerptHtml
    this.content = a.contentHtml
    this.excerpt_or_content = a.excerptHtml || a.contentHtml
    this.image = imageDrop(a.image)
    this.tags = a.tags
    this.published_at = a.publishedAt
    this.created_at = a.publishedAt
  }
}

export class BlogDrop extends Drop {
  readonly id: string
  readonly handle: string
  readonly title: string
  readonly url: string
  readonly articles: ArticleDrop[]
  readonly articles_count: number
  readonly all_tags: string[]
  readonly tags: string[]
  constructor(b: LiquidBlogData) {
    super()
    this.id = b.id
    this.handle = b.handle
    this.title = b.title
    this.url = b.url
    this.articles = b.articles.map((a) => new ArticleDrop(a))
    this.articles_count = b.articles.length
    this.all_tags = [...new Set(b.articles.flatMap((a) => a.tags))]
    this.tags = this.all_tags
  }
}

/** `blogs['news']`. */
export class BlogsDrop extends Drop {
  readonly #cache: LiquidDataCache
  constructor(cache: LiquidDataCache) {
    super()
    this.#cache = cache
  }
  override liquidMethodMissing(handle: string): unknown {
    const blog = this.#cache.blog(handle)
    return blog ? new BlogDrop(blog) : null
  }
}

export class PageDrop extends Drop {
  readonly id: string
  readonly handle: string
  readonly title: string
  readonly url: string
  readonly content: string
  readonly metafields = new MetafieldsDrop()
  constructor(p: LiquidPageData) {
    super()
    this.id = p.id
    this.handle = p.handle
    this.title = p.title
    this.url = `/pages/${p.handle}`
    this.content = p.contentHtml
  }
}

/** `pages['about']`. */
export class PagesDrop extends Drop {
  readonly #cache: LiquidDataCache
  constructor(cache: LiquidDataCache) {
    super()
    this.#cache = cache
  }
  override liquidMethodMissing(handle: string): unknown {
    const page = this.#cache.page(handle)
    return page ? new PageDrop(page) : null
  }
}

export function cartDrop(cart: LiquidCartData): Record<string, unknown> {
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
      id: i.id,
      key: i.id,
      quantity: i.quantity,
      title: i.title,
      price: i.price,
      final_price: i.price,
      original_price: i.price,
      line_price: i.linePrice,
      final_line_price: i.linePrice,
      original_line_price: i.linePrice,
      variant_id: i.id,
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

/** Shopify's `routes`, pointed at our pages. */
export const LIQUID_ROUTES = {
  root_url: '/',
  account_url: '/account',
  account_login_url: '/account/login',
  account_logout_url: '/account/logout',
  account_register_url: '/account/login',
  account_addresses_url: '/account/addresses',
  account_recover_url: '/account/login',
  collections_url: '/collections',
  all_products_collection_url: '/collections/all',
  search_url: '/search',
  predictive_search_url: '/search/suggest',
  cart_url: '/cart',
  cart_add_url: '/cart/add',
  cart_change_url: '/cart/change',
  cart_clear_url: '/cart/clear',
  cart_update_url: '/cart/update',
  product_recommendations_url: '/recommendations/products',
} as const
