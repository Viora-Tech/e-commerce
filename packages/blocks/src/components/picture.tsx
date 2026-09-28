import type { CSSProperties } from 'react'
import { thumbHashToDataURL } from 'thumbhash'

type PictureProps = {
  image: {
    url: string
    alt: string | null
    variants?: Record<string, { avif: string; webp: string }> | null | undefined
    thumbhash?: string | null | undefined
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
 * Smallest-to-largest generated widths, matching
 * `packages/core/src/media/constants.ts` (`VARIANT_WIDTHS`) — duplicated
 * rather than imported so this framework-agnostic block package stays free
 * of a `@commerce/core` dependency. Covered by
 * `packages/core/src/media/loader.test.ts`'s `generatedWidths` test, which
 * fails first if the two ever drift.
 */
const WIDTHS = [320, 640, 960, 1280, 1920] as const

function srcSet(variants: Record<string, { avif: string; webp: string }>, format: 'avif' | 'webp') {
  const entries: string[] = []
  for (const w of WIDTHS) {
    const entry = variants[String(w)]
    if (entry) entries.push(`${entry[format]} ${w}w`)
  }
  return entries.join(', ')
}

/**
 * The ThumbHash decodes to a tiny data URL, set as the `<img>`'s own CSS
 * background: it shows through until the real image finishes loading and
 * paints over it, with no JS and no extra DOM node. Malformed/undecodable
 * hashes (there should never be one, but a corrupt row is not worth a crash)
 * fall back to no placeholder rather than throwing.
 */
function blurStyle(thumbhash: string | null | undefined): CSSProperties | undefined {
  if (!thumbhash) return undefined
  try {
    const bytes = Uint8Array.from(atob(thumbhash), (c) => c.charCodeAt(0))
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
  const blur = placeholder ? blurStyle(image.thumbhash) : undefined
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
  const widest = WIDTHS.filter((w) => variants[String(w)]).at(-1)
  const fallbackWebp = widest ? variants[String(widest)]?.webp : undefined
  return (
    <picture style={fill ? FILL_WRAPPER : undefined}>
      <source type="image/avif" srcSet={srcSet(variants, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(variants, 'webp')} sizes={sizes} />
      <img
        className={className}
        style={style}
        src={fallbackWebp ?? image.url}
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
