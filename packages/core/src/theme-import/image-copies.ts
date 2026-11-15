/** SOURCE OF TRUTH: an image's sized copies for Liquid — WHAT: a media row's WebP copies by width, smallest first, worked out once per row / WHY: a page builds an image drop for every product image, variant image and variant media of every product it lists, from the same loaded rows, pass after pass; sorting the copies each time was a tenth of a home render */
import type { LiquidImageData } from './drops'

export type SizedCopies = readonly (readonly [number, string])[]

const NO_COPIES: SizedCopies = []

const sizedByVariants = new WeakMap<object, SizedCopies>()

/** The row's WebP copies as `[width, url]`, smallest first; the same array for the same row. */
export function sizedCopies(variants: LiquidImageData['variants']): SizedCopies {
  if (!variants) return NO_COPIES
  const known = sizedByVariants.get(variants)
  if (known) return known
  const sized = Object.entries(variants)
    .map(([width, files]) => [Number(width), files.webp] as const)
    .filter(([width, file]) => Number.isFinite(width) && Boolean(file))
    .sort((a, b) => a[0] - b[0])
  sizedByVariants.set(variants, sized)
  return sized
}
