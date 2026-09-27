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

/** A collection as the collection list section renders it. */
export type CardCollection = {
  handle: string
  title: string
  imageUrl: string | null
  productCount: number
}
