/**
 * Delivery-side helpers: turn a `media` row's `variants` map into the URLs a
 * `<picture>` element or a `next/image` loader needs, and decode its
 * ThumbHash into a blur-up placeholder. No `sharp` here on purpose — this
 * runs in the storefront and admin *apps*, and `sharp` (used only by the
 * upload-time pipeline, `./pipeline.ts`) must never end up in an app bundle.
 */
import { thumbHashToDataURL } from 'thumbhash'
import { VARIANT_WIDTHS } from './constants'

export type MediaVariants = Record<string, { avif: string; webp: string }> | null | undefined

export type PictureSource = {
  /** Original/master URL — always safe to fall back to (legacy or unprocessed media has no variants). */
  fallback: string
  /** Present only when `variants` had at least one entry for a width `<=` the requested one, or the smallest available. */
  avif?: string
  webp?: string
}

/**
 * The generated width closest to (but not above) `targetWidth`, or the
 * smallest generated width if the target is smaller than all of them
 * (never upscale past what exists). Returns null when there are no widths
 * to choose from.
 */
export function nearestVariantWidth(availableWidths: number[], targetWidth: number): number | null {
  if (availableWidths.length === 0) return null
  const sorted = [...availableWidths].sort((a, b) => a - b)
  const atOrBelow = sorted.filter((w) => w <= targetWidth)
  return atOrBelow.length > 0 ? (atOrBelow.at(-1) as number) : (sorted[0] as number)
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

/** Every width the pipeline generates, smallest first — what a `<Picture>`'s `srcSet` iterates. */
export function generatedWidths(): readonly number[] {
  return VARIANT_WIDTHS
}

/** Base64 ThumbHash → a tiny PNG data URL, safe to use directly as an `<img>` `src`/background while the real image loads. */
export function thumbhashPlaceholder(base64: string): string {
  const bytes = Uint8Array.from(Buffer.from(base64, 'base64'))
  return thumbHashToDataURL(bytes)
}
