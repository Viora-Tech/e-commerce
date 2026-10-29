/** SOURCE OF TRUTH: the Products list "Missing" filter values (weight, image, price) — WHAT `?missing=` accepts / WHY Store health links to the products that need fixing */
/**
 * The Products list's "Missing" filter (`?missing=weight`): products with a live variant that
 * has no weight, with no image, or (`price`) with a variant shoppers can see priced ₹0 (#934;
 * hidden variants left out). Store health links here to show which products to fix.
 */
export const PRODUCT_MISSING_FILTERS = ['weight', 'image', 'price'] as const
export type ProductMissingFilter = (typeof PRODUCT_MISSING_FILTERS)[number]
