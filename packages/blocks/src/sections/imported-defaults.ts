/**
 * SOURCE OF TRUTH KEYWORDS: imported theme defaults, withImportedDefaults, product page extras
 * WHAT:  The settings our sections start with on an imported Shopify theme where those differ
 *        from our own themes: on `MainProduct`, the extras the theme's buy box never had
 *        (EMI line, "Inclusive of all taxes", "Save ₹N", the "₹X with UPI" price, the
 *        dispatch line and the PIN code check) start switched off (#1049).
 * WHY:   Our own themes keep them on. An imported page should read as it did on Shopify, so
 *        each is a switch the merchant turns on. Pure (no React): the theme import writes these
 *        values, and the storefront and Customize fill them into an imported theme's sections
 *        that were saved before the switches existed, under what the merchant saved.
 * WHERE: `@commerce/core` theme-import/import.ts, the storefront's lib/template-render.tsx,
 *        the admin's lib/customize-doc.ts.
 */

/** `MainProduct` settings that are ours, not the theme's: off on an imported theme. */
const MAIN_PRODUCT_EXTRAS = [
  'showEmiHint',
  'showTaxNote',
  'showSaving',
  'showUpiPrice',
  'showDispatchLine',
  'showDeliveryEstimate',
  'showPreorderBadge',
] as const

const IMPORTED_DEFAULTS: Partial<Record<string, Record<string, unknown>>> = {
  MainProduct: {
    ...Object.fromEntries(MAIN_PRODUCT_EXTRAS.map((key) => [key, false])),
    showRatingInvite: true,
  },
}

/**
 * A section of an imported theme with the imported defaults under its saved props: a value
 * the merchant saved wins, a missing one reads as the imported default rather than ours.
 */
export function withImportedDefaults<T extends { type: string; props: Record<string, unknown> }>(
  section: T,
): T {
  const defaults = IMPORTED_DEFAULTS[section.type]
  return defaults ? { ...section, props: { ...defaults, ...section.props } } : section
}
