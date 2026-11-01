import type { RichTextValue } from '@commerce/richtext'
/** Data shapes blocks render. Apps fetch these; blocks never touch the database. */

/**
 * `media.variants`/`media.thumbhash` straight off the row (see
 * `@commerce/core`'s media pipeline). Optional/nullable throughout: legacy
 * or still-`processing` media has neither, and `<Picture>` (./components/picture)
 * falls back to plain `url` in that case.
 */
export type MediaImage = {
  url: string
  alt: string | null
  contentType?: string | null | undefined
  variants?: Record<string, { avif: string; webp: string }> | null | undefined
  thumbhash?: string | null | undefined
}

export type CardProduct = {
  id: string
  handle: string
  title: string
  vendor: string | null
  productType: string | null
  /** The cheapest priced variant; null when no variant has a price yet ("Price coming soon"). */
  pricePaise: number | null
  mrpPaise: number | null
  available: number
  images: MediaImage[]
  /** The variant a card's Quick add puts in the cart: set only when the product has exactly one. */
  quickAddVariantId?: string | null | undefined
  /**
   * Each priced variant's one-unit price, set when the product has several: the card reads
   * "From" the lowest as the shopper's market shows it (a catalog's fixed price, else converted).
   */
  variantPrices?: readonly { id: string; pricePaise: number }[] | undefined
  /**
   * Out of stock but still selling as a pre-order (the product page's rule): the card shows a
   * "Pre-order" badge and its button reads `buttonLabel` instead of "Sold out". Null otherwise.
   */
  preorder?: { buttonLabel: string } | null | undefined
  /** Published reviews (Reviews app); absent or null when the product has none. */
  rating?: { average: number; count: number } | null | undefined
}

/** One of the product's extra fields, ready to show: `text` to parse, `html` for a panel body. */
export type ProductFieldText = { text: string; html: string }

export type ProductDetail = {
  id: string
  handle: string
  title: string
  /** Lexical JSON, or a plain string from the Shopify import. */
  description: RichTextValue | string | null
  vendor: string | null
  productType: string | null
  images: MediaImage[]
  /** Alternate product template (`product.<suffix>`), when one is assigned. */
  templateSuffix?: string | null | undefined
  options: { id: string; name: string; values: { id: string; value: string }[] }[]
  variants: {
    id: string
    title: string
    sku: string | null
    /** Null: listed before the price is confirmed; shown as "Price coming soon", never purchasable. */
    pricePaise: number | null
    mrpPaise: number | null
    available: number
    /** Can be added to cart right now: normal stock, or pre-order room beyond it. `available` alone undercounts a pre-order. */
    purchasable: boolean
    /**
     * Sells on pre-order once out of stock: the product has pre-order on and this variant allows
     * it. Absent (older data, the editor's samples) follows `product.preorder.enabled`.
     */
    preorder?: boolean | undefined
    /**
     * Units that can still be pre-ordered beyond `available` when the variant sells on pre-order
     * with a limit; null or absent when there is no limit. The quantity picker's cap is
     * `available + preorderRoom`.
     */
    preorderRoom?: number | null | undefined
    optionValueIds: string[]
    /** The variant's main image (first of `imageUrls`). */
    imageUrl: string | null
    /** The variant's own images in order; the gallery shows them first once it is picked. */
    imageUrls?: string[] | undefined
  }[]
  /** Store-timezone instant the product goes on sale; null = already on sale. */
  launchAt?: string | null | undefined
  /**
   * The shopper's market sells from a catalog that leaves this product out (Markets ›
   * Catalogs): the page shows it as not available in their country, never sold.
   */
  notSoldHere?: boolean | undefined
  preorder?:
    | {
        enabled: boolean
        buttonLabel: string
        /** ISO date; null when neither an absolute date nor "ships in N days" is set. */
        shipDate: string | null
        /**
         * The pre-order note under the button (#936), ship date already filled in; null or
         * absent when the product and the store have none.
         */
        note?: string | null | undefined
        /** "Pay ₹X now, ₹Y later" preview at the selected variant's price; null in `full` mode. */
        depositPreview: { payNowPaise: number; payLaterPaise: number } | null
        /**
         * Set when the store keeps the deposit if the balance is not paid within
         * this many days of being requested; the product page says so up front.
         */
        nonRefundableDepositDays?: number | null | undefined
        /** The pre-order campaign's badge (#144), shown beside the button; absent without one. */
        badgeText?: string | null | undefined
        /** The campaign's price per unit while on pre-order, after its discount; absent without one. */
        preorderPricePaise?: number | null | undefined
        /** The campaign's colours (hex, already checked); null keys keep the theme's. */
        colours?:
          | {
              buttonBackground: string | null
              buttonText: string | null
              badgeBackground: string | null
              badgeText: string | null
            }
          | null
          | undefined
      }
    | null
    | undefined
  /** The product's `custom` extra fields by key (spec cells, metafield accordions); none when absent. */
  fields?: Record<string, ProductFieldText> | undefined
  /** The collection the breadcrumb names between Home and the product. */
  collection?: { title: string; url: string } | null | undefined
}

export type ThemeMode = 'light' | 'dark' | 'system'

/** A menu link as the header and footer render it; children nest up to three levels. */
export type NavLink = {
  /** The menu item's id, which keys the rendered list (two items may share an href). */
  id: string
  label: string
  href: string
  children?: NavLink[] | undefined
}

/** A blog post as cards render it; `href` is the storefront path. */
export type CardArticle = {
  id: string
  href: string
  title: string
  excerpt: string
  author: string
  /** ISO timestamp. */
  publishedAt: string
  /** The date as the store shows it, already in its time zone. */
  dateLabel: string
  imageUrl: string | null
  imageAlt: string | null
  blogTitle: string
}

/** One published review as the product page shows it (Reviews app). */
export type PublicReviewCard = {
  id: string
  rating: number
  title: string
  body: string
  /** First name and last initial. */
  name: string
  verified: boolean
  helpful: number
  /** The store's public reply. */
  reply: string | null
  /** "2 days ago", worked out on the server so the page hydrates with the same text. */
  whenLabel: string
  photos: { url: string; width: number | null; height: number | null }[]
}

/**
 * What the product page hands the Product reviews section when the store installed the
 * Reviews app (`puck.metadata.appBlockContext.reviews`). Plain data: the widget posts to the
 * storefront's `/reviews/*` routes, which take the store from the hostname.
 */
export type ReviewsWidgetContext = {
  productId: string
  productTitle: string
  productImage: string | null
  storeName: string
  summary: { rating: number; count: number; stars: number[] }
  reviews: PublicReviewCard[]
  /**
   * `open`: the form can be sent. `signin`: only verified buyers may review and we do not
   * know who this is yet. `not_buyer`: signed in, but no order holds this product.
   */
  write: 'open' | 'signin' | 'not_buyer'
  signInUrl: string
  /** The order that makes this shopper a verified buyer, shown in the form. */
  verifiedOrder: number | null
  /** The signed link from a review request email, sent back with the review. */
  requestToken: string | null
  /** Name and email we already know (signed in or from the order); the form then skips email. */
  knownName: string
  emailKnown: boolean
  /** Open the form on arrival (from a review request email). */
  openForm: boolean
  onlyVerified: boolean
  /** The store shows customer photos (Reviews settings). */
  showPhotos: boolean
  /** The AI "What customers say" text, when the store has summaries on and one is written. */
  aiSummary?: string | null | undefined
  /** Answered product questions (Q&A), newest answer first. */
  questions?: PublicQuestion[] | undefined
}

/** One answered question as a product page shows it. */
export type PublicQuestion = {
  id: string
  question: string
  /** First name and last initial of who asked. */
  name: string
  answer: string
  /** "2 days ago": when the store answered. */
  whenLabel: string
}

/** One published review as the Reviews app's theme sections draw it (carousel, wall, photos). */
export type StoreReviewCard = {
  id: string
  rating: number
  title: string
  body: string
  /** First name and last initial. */
  name: string
  verified: boolean
  /** ISO date the review was written. */
  createdAt: string
  /** The product reviewed; null on a store review. */
  product: { title: string; handle: string } | null
  /** Photo URLs, empty when the store hides customer photos. */
  photos: string[]
}

/** What a Reviews section asks for. */
export type StoreReviewsQuery = {
  limit: number
  minRating?: number | undefined
  withPhotos?: boolean | undefined
  /** Only these products' reviews; empty is the whole store. */
  productHandles?: string[] | undefined
}

/** The published reviews a Reviews section draws, with the rating summary of the same products. */
export type StoreReviews = {
  summary: { rating: number; count: number; stars: number[] }
  reviews: StoreReviewCard[]
}

/**
 * How a Reviews section gets its reviews: the storefront reads the database, the theme editor
 * calls the API. Null when the store has not installed the Reviews app.
 */
export type ReviewsLoader = (query: StoreReviewsQuery) => Promise<StoreReviews | null>

/** A collection as the collection list section renders it. */
export type CardCollection = {
  handle: string
  title: string
  imageUrl: string | null
  productCount: number
}
