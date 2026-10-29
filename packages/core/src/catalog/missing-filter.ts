/** SOURCE OF TRUTH: the Products list "Missing" filter values (weight, image) — WHAT `?missing=` accepts / WHY Store health links to the products that need fixing */
/**
 * The Products list's "Missing" filter (`?missing=weight`): products with a live variant that
 * has no weight, or with no image. Store health links here to show which products to fix.
 */
export const PRODUCT_MISSING_FILTERS = ['weight', 'image'] as const
export type ProductMissingFilter = (typeof PRODUCT_MISSING_FILTERS)[number]
