import type { RichTextValue } from '@commerce/richtext'
/** Data shapes blocks render. Apps fetch these; blocks never touch the database. */

export type CardProduct = {
  id: string
  handle: string
  title: string
  vendor: string | null
  productType: string | null
  pricePaise: number
  mrpPaise: number | null
  available: number
  images: { url: string; alt: string | null; contentType?: string | null | undefined }[]
}

export type ProductDetail = {
  id: string
  handle: string
  title: string
  /** Lexical JSON, or a plain string from the Shopify import. */
  description: RichTextValue | string | null
  vendor: string | null
  productType: string | null
  images: { url: string; alt: string | null; contentType?: string | null | undefined }[]
  options: { id: string; name: string; values: { id: string; value: string }[] }[]
  variants: {
    id: string
    title: string
    sku: string | null
    pricePaise: number
    mrpPaise: number | null
    available: number
    optionValueIds: string[]
    imageUrl: string | null
  }[]
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
