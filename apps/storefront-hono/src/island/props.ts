import type {
  CommerceTrackDetail,
  MainProductSettings,
  PolicyPanel,
  ReviewsCarousel,
  ReviewsWidget,
} from '@commerce/blocks'
import type { MarketPricing } from '@commerce/money'
import type { EmiOffersConfig } from '@commerce/plugin-emi/offer-for'
import type { ComponentProps } from 'react'
import type { ProductDetail } from '@/lib/catalog'

/**
 * What the buy box island needs, written into the page as JSON and read back in the browser:
 * the same data the Next product page hands `ProductView` (the product, the section's settings,
 * the UPI discount, the policy panels) plus, by name, the pieces Next passes as components or
 * server actions (`UnderPrice`, `NotifyMe`, the actions themselves, which the island calls
 * through `/theme-actions/island-*`), and the store's price format and market pricing the layout
 * provides.
 */
export type IslandProps = {
  product: ProductDetail
  settings: MainProductSettings
  upiDiscount: { type: 'fixed' | 'percent'; value: number } | null
  policyPanels: PolicyPanel[]
  /** The line under the price: the EMI app's offers, the older EMI hint, or none. */
  underPrice: 'emi-offers' | 'emi-hint' | null
  /** The EMI app's settings (its provider wraps the buy box), when installed. */
  emiConfig: EmiOffersConfig | null
  /** The back-in-stock app's form, when installed. */
  notifyMe: { whatsappEnabled: boolean } | null
  /** Settings › Store details price format (`Rs. {{amount}}`); null is the currency's own. */
  moneyFormat: string | null
  pricing: MarketPricing | null
  /** Where an add to cart goes under an imported theme (`ThemeCartAdded` on Next). */
  cartHref: string
  /** Our section sits in a `section-frame` div (the section's colour and spacing settings). */
  framed: boolean
  /** The Pixels app's ViewContent, as Next's `PixelTrack` fires it. */
  viewContent: CommerceTrackDetail
  /**
   * The Reviews app's widget, drawn into the theme's `reviews` app block slot when the page has
   * one (`LiquidAppBlock`, as the Next product page does); null when the app is not installed.
   */
  reviews: ComponentProps<typeof ReviewsWidget>['context'] | null
  /** The Reviews app's carousel for the theme's `reviews-carousel` slot (Next's layout draws it). */
  reviewsCarousel: ComponentProps<typeof ReviewsCarousel>['data'] | null
}

/** The `<script type="application/json">` the props travel in. */
export const ISLAND_PROPS_ID = 'hono-island-props'

/** A value JSON would change on the way (a Date becomes a string, a Map an empty object...). */
function lossy(value: unknown): string | null {
  if (value === null) return null
  const t = typeof value
  if (t === 'string' || t === 'boolean') return null
  if (t === 'number') return Number.isFinite(value) ? null : 'number'
  if (t !== 'object') return t
  if (Array.isArray(value)) {
    for (const v of value) {
      if (v === undefined) return 'undefined in array'
      const bad = lossy(v)
      if (bad) return bad
    }
    return null
  }
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) return proto?.constructor?.name ?? 'object'
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (v === undefined) continue
    const bad = lossy(v)
    if (bad) return bad
  }
  return null
}

/** U+2028 and U+2029, which end a line in a script. */
const LINE_SEPARATORS = /[\u2028\u2029]/g

/**
 * The props as the page's JSON, safe inside a `<script>` (`<` written as `\u003c`, so no value
 * can close it). Throws when a value would not come back the same in the browser, so the page is
 * drawn by Next instead of hydrating different props than it rendered.
 */
export function serializeIslandProps(props: IslandProps): string {
  const bad = lossy(props)
  if (bad) throw new Error(`island props: ${bad} does not survive JSON`)
  return JSON.stringify(props)
    .replace(/</g, '\\u003c')
    .replace(LINE_SEPARATORS, (c) => `\\u${c.charCodeAt(0).toString(16)}`)
}

/** The props back from the page's JSON. */
export function parseIslandProps(json: string): IslandProps {
  return JSON.parse(json) as IslandProps
}
