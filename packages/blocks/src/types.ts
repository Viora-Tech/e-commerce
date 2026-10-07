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
  pricePaise: number
  mrpPaise: number | null
  available: number
  images: MediaImage[]
}

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
    pricePaise: number
    mrpPaise: number | null
    available: number
    /** Can be added to cart right now: normal stock, or pre-order room beyond it. `available` alone undercounts a pre-order. */
    purchasable: boolean
    optionValueIds: string[]
    imageUrl: string | null
  }[]
  /** Store-timezone instant the product goes on sale; null = already on sale. */
  launchAt?: string | null | undefined
  preorder?:
    | {
        enabled: boolean
        buttonLabel: string
        /** ISO date; null when neither an absolute date nor "ships in N days" is set. */
        shipDate: string | null
        /** "Pay ₹X now, ₹Y later" preview at the selected variant's price; null in `full` mode. */
        depositPreview: { payNowPaise: number; payLaterPaise: number } | null
        /**
         * Set when the store keeps the deposit if the balance is not paid within
         * this many days of being requested; the product page says so up front.
         */
        nonRefundableDepositDays?: number | null | undefined
      }
    | null
    | undefined
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
}

/** A collection as the collection list section renders it. */
export type CardCollection = {
  handle: string
  title: string
  imageUrl: string | null
  productCount: number
}
