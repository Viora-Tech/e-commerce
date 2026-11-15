/** SOURCE OF TRUTH: media delivery URLs — WHAT picture sources and ThumbHash placeholders from a media row / WHY apps must never bundle sharp */
/**
 * Delivery-side helpers: turn a `media` row's `variants` map into the URLs a
 * `<picture>` element or a `next/image` loader needs, and decode its
 * ThumbHash into a blur-up placeholder. No `sharp` here on purpose — this
 * runs in the storefront and admin *apps*, and `sharp` (used only by the
 * upload-time pipeline, `./pipeline.ts`) must never end up in an app bundle.
 */
import { thumbHashToDataURL } from 'thumbhash'

export type MediaVariants = Record<string, { avif: string; webp: string }> | null | undefined

export type PictureSource = {
  /** Original/master URL — always safe to fall back to (legacy or unprocessed media has no variants). */
  fallback: string
  /** Present when `variants` has any entry: the smallest at least the requested width, else the largest. */
  avif?: string
  webp?: string
}

/**
 * The smallest generated width at least `targetWidth` wide, or the largest one when none is
 * (never upscale past what exists). Returns null when there are no widths to choose from.
 * It used to pick the closest width *below* the target, so a 700 px slot got the 640 copy
 * stretched; the Liquid filters' `ImageDrop.urlFor` rounds up the same way.
 */
export function nearestVariantWidth(availableWidths: number[], targetWidth: number): number | null {
  if (availableWidths.length === 0) return null
  const sorted = [...availableWidths].sort((a, b) => a - b)
  return sorted.find((w) => w >= targetWidth) ?? (sorted.at(-1) as number)
}

/**
 * Maps a media row + a requested width to the AVIF/WebP variant URLs to
 * serve, falling back to the original `url` when the row has no `variants`
 * yet (still `processing`, `failed`, or legacy/imported media the pipeline
 * never touched — see `service.ts`'s `status` states).
 */
export function pickVariantUrls(
  media: { url: string; variants: MediaVariants },
  targetWidth: number,
): PictureSource {
  if (!media.variants) return { fallback: media.url }
  const widths = Object.keys(media.variants).map(Number)
  const width = nearestVariantWidth(widths, targetWidth)
  if (width === null) return { fallback: media.url }
  const chosen = media.variants[String(width)]
  if (!chosen) return { fallback: media.url }
  return { fallback: media.url, avif: chosen.avif, webp: chosen.webp }
}

/**
 * `next/image` `loader` prop: maps `(src, width)` to the nearest
 * pre-generated variant for one format. next/image's loader contract
 * returns a single URL — it cannot vary the response by `Accept`/format —
 * so this always resolves to WebP (universally supported); use `<Picture>`
 * (below) instead of `next/image` wherever serving AVIF matters, since that
 * renders a real `<picture>` with an AVIF `<source>` and this loader only as
 * the `<img>` fallback.
 */
export function mediaImageLoader({
  src,
  width,
  variants,
}: {
  src: string
  width: number
  variants: MediaVariants
}): string {
  return pickVariantUrls({ url: src, variants }, width).webp ?? src
}

/** Base64 ThumbHash → a tiny PNG data URL, safe to use directly as an `<img>` `src`/background while the real image loads. */
export function thumbhashPlaceholder(base64: string): string {
  const bytes = Uint8Array.from(Buffer.from(base64, 'base64'))
  return thumbHashToDataURL(bytes)
}
