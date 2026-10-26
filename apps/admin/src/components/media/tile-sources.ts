/** SOURCE OF TRUTH: what a Files / gallery tile loads — WHAT the image URLs a tile tries in order and the video URL that shows a first frame / WHY a grid of 100 originals (2–20 MB each) left tiles grey for a long time (#811) */
import { type MediaVariants, pickVariantUrls } from '@commerce/core/media-loader'

/** Tile width the variant is chosen for: a 4:3 tile is at most ~18rem wide, 2x for retina. */
export const TILE_IMAGE_WIDTH = 640

/**
 * The URLs an image tile tries, best first: the pipeline's WebP copy at about the tile's width
 * (kilobytes rather than the multi-megabyte original), then the original. A file the worker has
 * not optimised yet (`processing`, or an import it never touched) has only the original.
 * The tile moves to the next URL when one fails and shows "Can't show this file" after the last.
 */
export function tileImageUrls(
  item: { url: string; variants?: MediaVariants },
  width: number = TILE_IMAGE_WIDTH,
): string[] {
  const picked = pickVariantUrls({ url: item.url, variants: item.variants }, width)
  return [...new Set([picked.webp, item.url].filter((u): u is string => Boolean(u)))]
}

/**
 * A video's URL with a media fragment at 0.1s, so a `<video preload="metadata">` paints that
 * frame instead of nothing (Safari draws no frame without it; Chrome may land on a black one at
 * 0). Left alone when the URL already carries a fragment.
 */
export function videoPreviewUrl(url: string): string {
  return url.includes('#') ? url : `${url}#t=0.1`
}
