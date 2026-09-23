/**
 * What the importer writes, whichever way it was read. The CSV parsers and the
 * Admin API mappers both produce these shapes; the writers only know these.
 * Money is paise, weights grams, dates ISO strings.
 */
import type { CollectionRules } from '@commerce/db'
import type { ImportResource } from './schema'

export type Issue = {
  resource: ImportResource
  row?: number | null | undefined
  ref?: string | null | undefined
  message: string
}

export type NImage = { src: string; alt: string | null; position: number }

export type NVariant = {
  sourceId: string | null
  optionValues: string[]
  sku: string | null
  barcode: string | null
  pricePaise: number
  mrpPaise: number | null
  costPaise: number | null
  taxable: boolean
  trackInventory: boolean
  weightGrams: number | null
  /** Null leaves stock as it is on re-import (the source did not say). */
  onHand: number | null
  hsCode: string | null
  /** Source URL of the variant's image; must also appear in the product images. */
  imageSrc: string | null
}

export type NProduct = {
  sourceId: string | null
  handle: string
  title: string
  bodyHtml: string | null
  vendor: string | null
  productType: string | null
  tags: string[]
  status: 'active' | 'draft' | 'archived'
  seoTitle: string | null
  seoDescription: string | null
  optionNames: string[]
  variants: NVariant[]
  images: NImage[]
  row?: number | undefined
}

export type NAddress = {
  name: string
  company: string | null
  line1: string
  line2: string | null
  city: string
  province: string | null
  provinceCode: string | null
  country: string | null
  countryCode: string | null
  zip: string
  phone: string | null
}

export type NCustomer = {
  sourceId: string | null
  email: string | null
  phone: string | null
  firstName: string | null
  lastName: string | null
  acceptsMarketing: boolean
  acceptsSmsMarketing: boolean
  tags: string[]
  note: string | null
  address: NAddress | null
  createdAt: string | null
  row?: number | undefined
}

export type NOrderLine = {
  title: string
  variantTitle: string | null
  sku: string | null
  /** Product handle when the source knows it (API); CSV lines match on SKU and title. */
  productHandle: string | null
  quantity: number
  unitPricePaise: number
  fulfilledQuantity: number
  taxable: boolean
}

export type NOrder = {
  sourceId: string | null
  /** `#1001` */
  name: string
  number: number | null
  email: string | null
  phone: string | null
  customerName: string | null
  financialStatus: string | null
  fulfillmentStatus: string | null
  currency: string | null
  subtotalPaise: number
  shippingPaise: number
  taxPaise: number
  totalPaise: number
  discountCode: string | null
  discountPaise: number
  refundedPaise: number
  paymentMethod: string | null
  paymentReference: string | null
  createdAt: string | null
  cancelledAt: string | null
  tags: string[]
  note: string | null
  shippingAddress: NAddress | null
  lines: NOrderLine[]
  row?: number | undefined
}

export type NCollection = {
  sourceId: string | null
  handle: string
  title: string
  bodyHtml: string | null
  image: NImage | null
  seoTitle: string | null
  seoDescription: string | null
  sortOrder: string | null
  /** Smart collection rules already mapped; null for a manual collection. */
  rules: CollectionRules | null
  /** Rules we could not express; the collection falls back to manual membership. */
  unmappedRules: string[]
  /** Member product handles in the source's order. */
  productHandles: string[]
  published: boolean
}

export type NPage = {
  sourceId: string | null
  handle: string
  title: string
  bodyHtml: string | null
  seoTitle: string | null
  seoDescription: string | null
  published: boolean
  publishedAt: string | null
}

export type NArticle = {
  sourceId: string | null
  blogHandle: string
  blogTitle: string
  handle: string
  title: string
  author: string | null
  bodyHtml: string | null
  summaryHtml: string | null
  tags: string[]
  image: NImage | null
  published: boolean
  publishedAt: string | null
  seoTitle: string | null
  seoDescription: string | null
}

export type NMenuItem = {
  title: string
  /** Shopify item type: FRONTPAGE, COLLECTION, PRODUCT, PAGE, BLOG, ARTICLE, HTTP, ... */
  type: string
  url: string | null
  items: NMenuItem[]
}

export type NMenu = { sourceId: string | null; handle: string; title: string; items: NMenuItem[] }

export type NRedirect = { sourceId: string | null; path: string; target: string }
