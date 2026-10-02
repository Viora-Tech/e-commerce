/** SOURCE OF TRUTH: Shopify's resource objects on our data — WHAT: `product`, `variant`, `collection(s)`, `all_products`, `linklist(s)`, `blog(s)`, `article`, `page(s)` as Liquid drops reading the request's data cache / WHY: themes walk these objects for every card, menu and post; one mapping keeps every section consistent with our catalogue */
import { Drop } from 'liquidjs'
import type { LiquidDataCache } from './cache'
import {
  handleize,
  ImageDrop,
  imageDrop,
  type LiquidArticleData,
  type LiquidBlogData,
  type LiquidCollectionData,
  type LiquidLinkData,
  type LiquidMenuData,
  type LiquidPageData,
  type LiquidProductData,
  type LiquidVariantData,
  MetafieldsDrop,
} from './drops'
import { numericId } from './numeric-id'

class VariantDrop extends Drop {
  /** A whole number, as Shopify ids are (see `numeric-id.ts`). */
  readonly id: number | string
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
    this.id = numericId(v.id)
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

const minOf = (xs: number[]) => (xs.length ? Math.min(...xs) : 0)
const maxOf = (xs: number[]) => (xs.length ? Math.max(...xs) : 0)

export class ProductDrop extends Drop {
  readonly id: number | string
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
  readonly options_with_values: {
    name: string
    position: number
    values: string[]
    selected_value: string | null
  }[]
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
  readonly selling_plan_groups: {
    id: string
    name: string
    app_id: string
    selling_plans: unknown[]
  }[]
  readonly template_suffix = ''
  readonly quantity_price_breaks_configured = false
  constructor(p: LiquidProductData) {
    super()
    // Pre-order apps on Shopify mark products with a selling plan group; ours is built in.
    this.selling_plan_groups = p.preorder
      ? [{ id: 'preorder', name: 'Pre-order', app_id: 'commerce', selling_plans: [] }]
      : []
    this.id = numericId(p.id)
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
    this.first_available_variant =
      this.variants.find((v) => v.available) ?? this.variants[0] ?? null
    this.selected_or_first_available_variant = this.first_available_variant
    this.available = this.variants.some((v) => v.available)
    this.has_only_default_variant =
      p.variants.length <= 1 && (p.options.length === 0 || p.options[0]?.name === 'Title')
    this.created_at = p.createdAt
    this.published_at = p.createdAt
  }
  /** Used as a key (`collections[setting]`), a resource reads as its handle, as on Shopify. */
  override valueOf(): string {
    return this.handle
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
  /** Used as a key (`collections[setting]`), a resource reads as its handle, as on Shopify. */
  override valueOf(): string {
    return this.handle
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

class LinkDrop extends Drop {
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
  /** Used as a key (`collections[setting]`), a resource reads as its handle, as on Shopify. */
  override valueOf(): string {
    return this.handle
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
  /** Used as a key (`collections[setting]`), a resource reads as its handle, as on Shopify. */
  override valueOf(): string {
    return this.handle
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
  /** Used as a key (`collections[setting]`), a resource reads as its handle, as on Shopify. */
  override valueOf(): string {
    return this.handle
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
