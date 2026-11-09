import type { CSSProperties } from 'react'
import { thumbHashToDataURL } from 'thumbhash'

type PictureProps = {
  image: {
    url: string
    alt: string | null
    variants?: Record<string, { avif: string; webp: string }> | null | undefined
    thumbhash?: string | null | undefined
    /** The original's pixel width, when known (see `srcSet`). */
    width?: number | null | undefined
  }
  alt: string
  className?: string | undefined
  /** Merged over the ThumbHash background, e.g. a focal point's `object-position`. */
  style?: CSSProperties | undefined
  /** Intrinsic size hints; leave out when CSS sizes the image (see `fill`). */
  width?: number | undefined
  height?: number | undefined
  /**
   * The image is sized by its container (`width/height: 100%`, `absolute inset-0`).
   * The `<picture>` wrapper then takes no box of its own (`display: contents`), so
   * those percentages still resolve against the container exactly as they did for
   * a bare `<img>`: swapping one in never changes the layout.
   */
  fill?: boolean | undefined
  /** Off for `object-fit: contain` images, where the blur would show in the letterbox. */
  placeholder?: boolean | undefined
  loading?: 'lazy' | 'eager' | undefined
  fetchPriority?: 'high' | 'low' | 'auto' | undefined
  sizes?: string | undefined
  ariaHidden?: boolean | undefined
}

/**
 * The widths a media row actually has, smallest first. Read from the row rather than a
 * fixed list so older media (which may carry a 960 variant) and newer media (which does
 * not) both get a full srcset.
 */
const widthsOf = (variants: Record<string, unknown>) =>
  Object.keys(variants)
    .map(Number)
    .filter((w) => Number.isFinite(w))
    .sort((a, b) => a - b)

/**
 * The original file as one more width when it is wider than every variant: the pipeline makes
 * only widths at or below the original (no upscaling), so a 480 px original has just a 320
 * variant and was shown blurry at 1000 px (#1271). The original is never upscaled either; the
 * browser just gets 480 to pick instead of 320. Its format (PNG, JPEG) does not match the
 * `<source>`'s type, which browsers ignore once a candidate is chosen.
 */
function originalCandidate(
  image: { url: string; width?: number | null | undefined },
  widths: readonly number[],
): { url: string; width: number } | null {
  const widest = widths.at(-1) ?? 0
  return image.width && image.width > widest ? { url: image.url, width: image.width } : null
}

function srcSet(
  variants: Record<string, { avif: string; webp: string }>,
  format: 'avif' | 'webp',
  original: { url: string; width: number } | null,
) {
  const entries: string[] = []
  for (const w of widthsOf(variants)) {
    const entry = variants[String(w)]
    if (entry) entries.push(`${entry[format]} ${w}w`)
  }
  if (original) entries.push(`${original.url} ${original.width}w`)
  return entries.join(', ')
}

/**
 * The ThumbHash decodes to a tiny data URL, set as the `<img>`'s own CSS
 * background: it shows through until the real image finishes loading and
 * paints over it, with no JS and no extra DOM node. Malformed/undecodable
 * hashes (there should never be one, but a corrupt row is not worth a crash)
 * fall back to no placeholder rather than throwing.
 *
 * Not for a picture with transparency (a product cut out on no background): the blur stays
 * under the loaded image and shows through its empty parts as a coloured halo (Waimers
 * collection grid, 2026-10-27). ThumbHash marks transparency in bit 7 of its third byte; a PNG,
 * WebP or GIF original whose hash came from a flattened copy is treated the same way.
 */
function blurStyle(thumbhash: string | null | undefined, url: string): CSSProperties | undefined {
  if (!thumbhash || /\.(png|webp|gif|svg)(\?|$)/i.test(url)) return undefined
  try {
    const bytes = Uint8Array.from(atob(thumbhash), (c) => c.charCodeAt(0))
    if (((bytes[2] ?? 0) & 0x80) !== 0) return undefined
    const dataUrl = thumbHashToDataURL(bytes)
    return {
      backgroundImage: `url(${dataUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  } catch {
    return undefined
  }
}

/** Inline, because the shared stylesheet's unlayered `picture { display: block }` outranks utilities. */
const FILL_WRAPPER: CSSProperties = { display: 'contents' }

/**
 * Native `<picture>` with AVIF and WebP sources at every pre-generated
 * width, falling back to the original `url` (unprocessed/legacy media, or
 * when the pipeline never got to it — see `media.status`). No JS: the
 * browser negotiates format and width itself from `srcSet`/`sizes`, which is
 * why this beats a `next/image` custom loader (`@commerce/core`'s
 * `mediaImageLoader`) for anything that matters — that loader can only ever
 * resolve to one URL, so it only serves WebP.
 */
export default function Picture({
  image,
  alt,
  className,
  style: ownStyle,
  width,
  height,
  fill,
  placeholder = true,
  loading = 'lazy',
  fetchPriority,
  sizes,
  ariaHidden,
}: PictureProps) {
  // Render logic
  const variants = image.variants
  const blur = placeholder ? blurStyle(image.thumbhash, image.url) : undefined
  const style = blur || ownStyle ? { ...blur, ...ownStyle } : undefined

  // Early returns
  if (!variants || Object.keys(variants).length === 0) {
    return (
      <img
        className={className}
        style={style}
        src={image.url}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        fetchPriority={fetchPriority}
        sizes={sizes}
        aria-hidden={ariaHidden}
      />
    )
  }
  const widths = widthsOf(variants)
  const widest = widths.at(-1)
  const original = originalCandidate(image, widths)
  const fallbackWebp = widest ? variants[String(widest)]?.webp : undefined
  return (
    <picture style={fill ? FILL_WRAPPER : undefined}>
      <source type="image/avif" srcSet={srcSet(variants, 'avif', original)} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(variants, 'webp', original)} sizes={sizes} />
      <img
        className={className}
        style={style}
        src={original ? image.url : (fallbackWebp ?? image.url)}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        fetchPriority={fetchPriority}
        sizes={sizes}
        aria-hidden={ariaHidden}
      />
    </picture>
  )
}
