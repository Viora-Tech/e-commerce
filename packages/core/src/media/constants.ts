/** SOURCE OF TRUTH: image variant sizes — WHAT the master long-edge cap and the variant widths / WHY the upload pipeline and the delivery loader must agree on them */
/**
 * Shared between `pipeline.ts` (which needs `sharp`) and `loader.ts` (which
 * must never import `sharp` into an app bundle) — kept in their own
 * dependency-free file so neither has to import the other.
 */

/** Never upscale past the source; never generate a master bigger than this on the long edge. */
export const MAX_MASTER_LONG_EDGE = 2560
/** Skip generating a variant wider than the cleaned master (no upscaling). */
export const VARIANT_WIDTHS = [320, 640, 960, 1280, 1920] as const
