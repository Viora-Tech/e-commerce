/** SOURCE OF TRUTH: our data and Shopify's basic Liquid objects — WHAT: the plain data an imported theme reads (`LiquidData*` types the store loader fills, extra fields and content entries included) and the small objects every theme prints: images, videos, colours, colour schemes, fonts / WHY: a theme's markup reads Shopify's objects; these shapes are what lets a theme LOOK the same while every value comes from our store */
import { Drop } from 'liquidjs'
import type { BrowseFacets } from '../catalog/browse'
import type { BrowseFilters, BrowseSort } from '../catalog/browse-params'
import type { StorefrontFilterConfig } from '../catalog/filter-config'
import type { FieldType, MeasureKind } from '../metaobjects/schemas'
import { numericId } from './numeric-id'

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
  /** Sells past zero on pre-order (Shopify's `inventory_policy: continue`, #962). */
  preorder?: boolean | undefined
  sku: string | null
  barcode: string | null
  options: string[]
  /** The variant's main image (`variant.image` / `featured_media`), carrying the media id. */
  image: LiquidImageData | null
  /** The variant's images in order, first = `image`; empty when it has none of its own. */
  media?: LiquidImageData[] | undefined
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
  /** Handles of the active collections it is in (`product.collections`); none when not loaded. */
  collectionHandles?: string[] | undefined
}

/** Shopify's recommendation intents (`/recommendations/products?intent=`). */
export type RecommendationIntent = 'related' | 'complementary'

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

/** The signed-in shopper, as the Liquid `customer` global reads them (null signed out). */
export type LiquidCustomerData = {
  id: string
  email: string | null
  name: string | null
  phone: string | null
  acceptsMarketing: boolean
  tags: string[]
  /** Orders placed (not drafts, cancelled or test orders). */
  ordersCount: number
  /** What those orders came to, in hundredths of the page's currency like every price here. */
  totalSpent: number
  /** The address of the latest order, without its phone. */
  defaultAddress: {
    name: string
    line1: string
    line2: string | null
    city: string
    stateCode: string
    pincode: string
    country: string
  } | null
  addressesCount: number
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
  /**
   * Published store policies (Settings → Policies) in footer order, for `shop.policies` and
   * `shop.privacy_policy` etc. `type` is the policy's handle (`privacy-policy`...), `url` our
   * `/policies/<type>` page.
   */
  policies: LiquidPolicyData[]
}

/** One published store policy, for Shopify's `policy` object. */
export type LiquidPolicyData = { type: string; title: string; url: string }

/** A file an extra field points at (an image, or any other file in Files). */
export type LiquidFileData = LiquidImageData & { id: string; contentType: string | null }

/** A record an extra field links to: enough for the drops to find it in the request cache. */
export type LiquidFieldRef =
  | { kind: 'file'; id: string; file: LiquidFileData }
  | { kind: 'product'; id: string; handle: string }
  | { kind: 'collection'; id: string; handle: string }
  | { kind: 'page'; id: string; handle: string }
  | { kind: 'article'; id: string; handle: string; blogHandle: string }
  | { kind: 'variant'; id: string; productHandle: string }
  | { kind: 'metaobject'; id: string }

/**
 * One extra-field value as a theme reads it: our stored value with every reference
 * swapped for a `LiquidFieldRef` (hidden or deleted targets drop out) and rich text as HTML.
 */
export type LiquidFieldData = {
  key: string
  type: FieldType
  list: boolean
  /** Measurements only: weight, length or volume (Shopify's weight, dimension, volume). */
  measure: MeasureKind | null
  value: unknown
}

/** An extra field (metafield) on a product or collection. */
export type LiquidMetafieldData = LiquidFieldData & { namespace: string }

/** One content entry (metaobject); `type` is its content type's handle. */
export type LiquidMetaobjectData = {
  id: string
  handle: string
  type: string
  fields: LiquidFieldData[]
}

/** Owners our extra fields live on. */
export type LiquidMetafieldOwner = 'product' | 'collection'

/** What one custom-data load returns; the request cache keeps all of it. */
export type LiquidCustomData = {
  /** Owner id to its extra fields; owners with none are absent. */
  metafields: Record<string, LiquidMetafieldData[]>
  /** Entries asked for, plus the ones their values link to (a few levels deep). */
  entries: LiquidMetaobjectData[]
}

/** A collection or search listing for a Liquid theme: one page of products and its filters. */
export type LiquidBrowseData = {
  products: LiquidProductData[]
  total: number
  facets: BrowseFacets
  /** The store's filter settings; null (or left out) draws the default filters. */
  filterConfig?: StorefrontFilterConfig | null | undefined
  filters: BrowseFilters
  sort: BrowseSort
  q: string
}

/**
 * Everything a render can ask our store for. Each call is per request; the store
 * loader caches within one request, so a header and a footer asking for the same
 * menu cost one query.
 */
export type LiquidDataSource = {
  shop: LiquidShopData
  product(handle: string): Promise<LiquidProductData | null>
  /**
   * Several products by handle in one load (a grid of `all_products[...]` reads in one render
   * pass). Optional: without it the cache asks `product` once per handle.
   */
  products?: ((handles: string[]) => Promise<Map<string, LiquidProductData>>) | undefined
  collection(handle: string): Promise<LiquidCollectionData | null>
  /** A collection's products in its own order, the first `limit` of them. */
  collectionProducts(handle: string, limit: number): Promise<LiquidProductData[]>
  /**
   * Several collections' products in one load (category tabs, a grid of collections). Optional:
   * without it the cache asks `collectionProducts` once per collection.
   */
  collectionsProducts?:
    | ((handles: string[], limit: number) => Promise<Map<string, LiquidProductData[]>>)
    | undefined
  collections(): Promise<LiquidCollectionData[]>
  /**
   * Shopify's product recommendations for one product (our UUID), available ones only.
   * `related`: the merchant's picks (Search & Discovery's `related_products`), then shared
   * collection, type and tags. `complementary`: the merchant's `complementary_products` only.
   */
  relatedProducts(
    productId: string,
    limit: number,
    intent?: RecommendationIntent,
  ): Promise<LiquidProductData[]>
  menu(handle: string): Promise<LiquidMenuData | null>
  blog(handle: string): Promise<LiquidBlogData | null>
  page(handle: string): Promise<LiquidPageData | null>
  cart(): Promise<LiquidCartData>
  /** The signed-in shopper; absent or null when nobody is signed in (the editor, a cache warm). */
  customer?: (() => Promise<LiquidCustomerData | null>) | undefined
  /** Extra fields of many owners at once (one batch per render pass). */
  metafields(ownerType: LiquidMetafieldOwner, ownerIds: string[]): Promise<LiquidCustomData>
  /** Every published entry of one content type, in order, with the entries they link to. */
  metaobjectsOfType(type: string): Promise<LiquidCustomData>
  /** Published entries by id, with the entries they link to. */
  metaobjects(ids: string[]): Promise<LiquidCustomData>
  /**
   * Files the Shopify importer copied, by their Shopify file name (lowercase) → our URL, for
   * `file_url`. Optional: a source without it leaves `file_url` pointing at the old store.
   */
  importedFiles?: (() => Promise<Map<string, string>>) | undefined
  /**
   * Judge.me's shop-wide review data (`shop.metafields.judgeme.*`: `reviews_grid`,
   * `all_reviews_rating`...), built from the Reviews app; null when the app is not installed.
   */
  judgeme?: (() => Promise<Record<string, unknown> | null>) | undefined
  /**
   * A listing with the request's filters, sort and page applied (`collection.products` and
   * `collection.filters` on a collection page, `search` on the search page). `collectionId`
   * null lists every product. Optional: without it a theme sees the first products unfiltered.
   */
  browse?:
    | ((input: {
        collectionId: string | null
        query: Record<string, string | string[] | undefined>
        perPage: number
      }) => Promise<LiquidBrowseData>)
    | undefined
}

/**
 * Reviews for imported themes, handed in by the storefront when the Reviews app is
 * installed (core never imports the app): ratings per product for Shopify's standard
 * `product.metafields.reviews.rating` / `.rating_count`, and Judge.me's shop data.
 */
export type LiquidReviewsSource = {
  ratings(productIds: string[]): Promise<Map<string, { rating: number; count: number }>>
  judgeme(): Promise<Record<string, unknown>>
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

/** A stable whole number for an image we only know by URL. */
function urlNumber(url: string): number {
  let h = 0
  for (let i = 0; i < url.length; i++) h = (Math.imul(h, 31) + url.charCodeAt(i)) | 0
  return Math.abs(h)
}

export class ImageDrop extends Drop {
  readonly src: string
  readonly url: string
  readonly alt: string
  readonly width: number
  readonly height: number
  readonly aspect_ratio: number
  readonly id: number | string
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
    // Themes write media ids into JSON unquoted, as Shopify's are numbers.
    this.id = image.id ? numericId(image.id) : urlNumber(image.url)
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

/** A video copied into Files (a `video` setting): plays through `video_tag`, poster as `preview_image`. */
export class VideoDrop extends Drop {
  readonly media_type = 'video'
  readonly id: number
  readonly alt = ''
  readonly aspect_ratio = 16 / 9
  readonly sources: {
    url: string
    mime_type: string
    format: string
    width: number
    height: number
  }[]
  readonly preview_image: ImageDrop | null
  constructor(video: { url: string; mobileUrl?: string | null; poster?: LiquidImageData | null }) {
    super()
    this.id = urlNumber(video.url)
    // Shopify lists a video's renditions; themes pick by height (a phone-sized one under 720).
    this.sources = [
      { url: video.url, mime_type: 'video/mp4', format: 'mp4', width: 1920, height: 1080 },
      ...(video.mobileUrl && video.mobileUrl !== video.url
        ? [
            {
              url: video.mobileUrl,
              mime_type: 'video/mp4',
              format: 'mp4',
              width: 1280,
              height: 720,
            },
          ]
        : []),
    ]
    this.preview_image = imageDrop(video.poster)
  }
  override valueOf(): string {
    return this.sources[0]?.url ?? ''
  }
}

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
    this.fallback_families =
      name.includes('serif') && !name.includes('sans') ? 'serif' : 'sans-serif'
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
