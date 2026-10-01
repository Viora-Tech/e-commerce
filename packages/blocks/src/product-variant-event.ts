/**
 * SOURCE OF TRUTH KEYWORDS: variant:changed, announceVariant, onVariantChange, selected variant
 * WHAT:  The DOM event the product page's buy box fires when the shopper picks a variant,
 *        and the listener other sections use to follow it.
 * WHY:   Sections are separate trees on the storefront (each rendered by the template), so
 *        the sticky add-to-cart bar cannot read ProductView's state. The source theme solved
 *        the same thing with a `variant:changed` event on `document`; we keep its name.
 * WHERE: Fired by `components/product-view.tsx` (on mount and on every pick); read by
 *        `components/sticky-atc.tsx`. A listener filters on `productId`, so a featured
 *        product elsewhere on the page never moves the bar.
 */

const VARIANT_CHANGED = 'variant:changed'

export type VariantChangedDetail = { productId: string; variantId: string }

export function announceVariant(detail: VariantChangedDetail) {
  document.dispatchEvent(new CustomEvent<VariantChangedDetail>(VARIANT_CHANGED, { detail }))
}

/** Calls `listener` with each variant picked for `productId`; returns the unsubscribe. */
export function onVariantChange(productId: string, listener: (variantId: string) => void) {
  const handle = (event: Event) => {
    const detail = (event as CustomEvent<VariantChangedDetail>).detail
    if (detail?.productId === productId) listener(detail.variantId)
  }
  document.addEventListener(VARIANT_CHANGED, handle)
  return () => document.removeEventListener(VARIANT_CHANGED, handle)
}
