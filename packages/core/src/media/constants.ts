/** SOURCE OF TRUTH: image variant sizes — WHAT the master long-edge cap and the variant widths / WHY the upload pipeline and the delivery loader must agree on them */
/**
 * Shared between `pipeline.ts` (which needs `sharp`) and `loader.ts` (which
 * must never import `sharp` into an app bundle) — kept in their own
 * dependency-free file so neither has to import the other.
 */

/** Never upscale past the source; never generate a master bigger than this on the long edge. */
export const MAX_MASTER_LONG_EDGE = 2560
/** Skip generating a variant wider than the cleaned master (no upscaling). */
export const VARIANT_WIDTHS = [320, 640, 1280, 1920] as const

/**
 * `stores/x/media/id-name.jpg` + width 640 + `avif` → a sibling key the
 * variant is written to. Kept as a pure string function (here, away from
 * `sharp`) so the worker, backfill script and admin tooling such as the AI
 * product writer agree on the same layout without re-deriving it.
 */
export function variantKey(masterKey: string, width: number, format: 'avif' | 'webp'): string {
  const dot = masterKey.lastIndexOf('.')
  const base = dot === -1 ? masterKey : masterKey.slice(0, dot)
  return `${base}-w${width}.${format}`
}
