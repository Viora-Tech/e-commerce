/** SOURCE OF TRUTH: app block slots — WHAT: which Shopify app blocks one of our apps draws instead, and the attribute naming the slot left for its widget / WHY: browser-safe (no imports), so the storefront's client component finds the slot by the same name core writes */
/** The attribute on a slot the storefront fills with one of our widgets (`data-commerce-app-block="reviews"`). */
export const APP_BLOCK_SLOT_ATTR = 'data-commerce-app-block'

/** Our widgets that stand in for app blocks. */
export type AppBlockSlot = 'reviews' | 'reviews-carousel'

/** Judge.me's product review widget (`shopify://apps/judge-me-reviews/blocks/review_widget/<uuid>`). */
const REVIEW_WIDGET = /^shopify:\/\/apps\/judge-me[\w-]*\/blocks\/review_widget(?:\/|$)/i

/** Judge.me's review cards (`shopify://apps/judge-me-reviews/blocks/cards_carousel/<uuid>`). */
const CARDS_CAROUSEL = /^shopify:\/\/apps\/judge-me[\w-]*\/blocks\/cards_carousel(?:\/|$)/i

/** The widget of ours that draws an app block, or null when we have none for it. */
export function appBlockSlot(type: string): AppBlockSlot | null {
  if (REVIEW_WIDGET.test(type)) return 'reviews'
  return CARDS_CAROUSEL.test(type) ? 'reviews-carousel' : null
}
