/** How the product edit page lays out its sections: a vertical sub-nav ("settings") or a tab strip ("tabs"). */
export const PRODUCT_LAYOUTS = ['tabs', 'settings'] as const

export type ProductLayout = (typeof PRODUCT_LAYOUTS)[number]

export const DEFAULT_PRODUCT_LAYOUT: ProductLayout = 'tabs'

/** Per-member preference, set under Account › Appearance and read by the product page on the server. */
export const PRODUCT_LAYOUT_COOKIE = 'admin_product_layout'

const ONE_YEAR = 60 * 60 * 24 * 365

export function parseProductLayout(value: string | undefined): ProductLayout {
  return PRODUCT_LAYOUTS.find((l) => l === value) ?? DEFAULT_PRODUCT_LAYOUT
}

/** Browser only. */
export function writeProductLayoutCookie(layout: ProductLayout) {
  // biome-ignore lint/suspicious/noDocumentCookie: a plain first-party preference cookie.
  document.cookie = `${PRODUCT_LAYOUT_COOKIE}=${layout}; path=/; max-age=${ONE_YEAR}; samesite=lax`
}
