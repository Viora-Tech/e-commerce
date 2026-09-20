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
  images: { url: string; alt: string | null }[]
}

export type ProductDetail = {
  id: string
  handle: string
  title: string
  description: string | null
  vendor: string | null
  productType: string | null
  images: { url: string; alt: string | null }[]
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
