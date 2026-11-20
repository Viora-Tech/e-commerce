/** SOURCE OF TRUTH: app block slots — WHAT: which Shopify app blocks one of our apps draws instead, the attribute naming the slot left for its widget, and how an app block we cannot draw is named in the editor / WHY: browser-safe (no imports), so the storefront's client component and the admin canvas find the slot by the same name core writes */
/** The attribute on a slot the storefront fills with one of our widgets (`data-commerce-app-block="reviews"`). */
export const APP_BLOCK_SLOT_ATTR = 'data-commerce-app-block'

/**
 * The attribute on the editor's placeholder for an app block none of our apps draws
 * (`data-commerce-app-block-missing="Klaviyo: Back in stock"`). Only a design-mode render (the
 * editor canvas) writes it; the storefront prints nothing for such a block.
 */
export const APP_BLOCK_MISSING_ATTR = 'data-commerce-app-block-missing'

/** Our widgets that stand in for app blocks. */
export type AppBlockSlot = 'reviews' | 'reviews-carousel'

/** A block of a Shopify app (`shopify://apps/<app>/blocks/<block>/<uuid>`), not theme code. */
const APP_BLOCK = /^shopify:\/\/apps\/([^/]+)\/blocks\/([^/]+)/i

/** Reviews apps whose product review widget our Reviews app draws (it holds the imported reviews). */
const REVIEWS_APPS =
  /^(judge-me[\w-]*|loox[\w-]*|yotpo[\w-]*|okendo[\w-]*|stamped[\w-]*|product-reviews)$/i

/** A reviews app's main widget (`review_widget`, `reviews`, `product-reviews`). */
const REVIEW_WIDGET =
  /^(review_widget|reviews?_widget|reviews?|product[_-]reviews?|main[_-]widget)$/i

/** Judge.me's review cards (`shopify://apps/judge-me-reviews/blocks/cards_carousel/<uuid>`). */
const CARDS_CAROUSEL = /^cards_carousel$/i

/** Whether a block's type names a Shopify app block rather than a theme block. */
export function isAppBlockType(type: string): boolean {
  return APP_BLOCK.test(type)
}

/** The widget of ours that draws an app block, or null when we have none for it. */
export function appBlockSlot(type: string): AppBlockSlot | null {
  const match = APP_BLOCK.exec(type)
  if (!match) return null
  const [, app = '', block = ''] = match
  if (/^judge-me/i.test(app) && CARDS_CAROUSEL.test(block)) return 'reviews-carousel'
  return REVIEWS_APPS.test(app) && REVIEW_WIDGET.test(block) ? 'reviews' : null
}

/** `judge-me-reviews` → `Judge me reviews`, `back_in_stock` → `Back in stock`. */
const words = (handle: string): string => {
  const text = handle.replace(/[-_]+/g, ' ').trim()
  return text ? text[0]?.toUpperCase() + text.slice(1).toLowerCase() : ''
}

/**
 * An app block's name for the merchant, from its type: the app, then the block
 * (`Klaviyo: Back in stock`). Empty for a type that is not an app block.
 */
export function appBlockName(type: string): string {
  const match = APP_BLOCK.exec(type)
  if (!match) return ''
  const app = words(decodeURIComponent(match[1] ?? ''))
  const block = words(decodeURIComponent(match[2] ?? ''))
  return block && block.toLowerCase() !== app.toLowerCase() ? `${app}: ${block}` : app
}
