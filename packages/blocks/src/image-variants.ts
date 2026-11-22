import type { MediaImage } from './types'

/**
 * SOURCE OF TRUTH KEYWORDS: compact image variants, RSC payload, product images
 * WHAT:  A media row's `variants` map (one AVIF and one WebP URL per width) sent as just its
 *        widths, and rebuilt in the browser from the image's own URL. Only lossless: an image
 *        is compacted when every variant URL is exactly the one rebuilt from its URL (the
 *        media pipeline's naming, `variantKey` in `@commerce/core`'s `media/constants.ts`);
 *        anything else (a legacy row, another host) keeps its map as it is.
 * WHY:   A client component's props are serialised into the page's RSC payload. The buy box's
 *        18 product images carried 36 KB there, 10 near-identical CDN URLs each (Lofree Hyzen
 *        on waimers.in, 22 Nov 2026); their widths are about 30 bytes.
 * WHERE: compacted by the storefront product page (`lib/product-view-props.ts`), rebuilt at
 *        the top of `ProductView`.
 */

type Variants = NonNullable<MediaImage['variants']>

/** `…/id-name.jpg`, 640, `avif` → `…/id-name-w640.avif`, as the media pipeline names it. */
export function variantUrl(url: string, width: number, format: 'avif' | 'webp'): string {
  const dot = url.lastIndexOf('.')
  const slash = url.lastIndexOf('/')
  const base = dot > slash ? url.slice(0, dot) : url
  return `${base}-w${width}.${format}`
}

function rebuilt(url: string, widths: readonly number[]): Variants {
  return Object.fromEntries(
    widths.map((w) => [
      String(w),
      { avif: variantUrl(url, w, 'avif'), webp: variantUrl(url, w, 'webp') },
    ]),
  )
}

/** The image with its variants as widths alone, when they rebuild exactly; else unchanged. */
export function compactImageVariants(image: MediaImage): MediaImage {
  const variants = image.variants
  if (!variants) return image
  const keys = Object.keys(variants)
  const widths = keys.map(Number)
  if (!keys.length || widths.some((w, i) => !Number.isInteger(w) || String(w) !== keys[i])) {
    return image
  }
  const again = rebuilt(image.url, widths)
  const same = keys.every(
    (k) => variants[k]?.avif === again[k]?.avif && variants[k]?.webp === again[k]?.webp,
  )
  if (!same) return image
  const { variants: _variants, ...rest } = image
  return { ...rest, variantWidths: widths }
}

/** The image with its `variants` map back, rebuilt from `variantWidths`. */
export function expandImageVariants(image: MediaImage): MediaImage {
  if (!image.variantWidths || image.variants) return image
  const { variantWidths, ...rest } = image
  return { ...rest, variants: rebuilt(image.url, variantWidths) }
}

/** Every image of a product (or anything with `images`) rebuilt; the same object when none was compact. */
export function withImageVariants<P extends { images: MediaImage[] }>(item: P): P {
  if (!item.images.some((i) => i.variantWidths && !i.variants)) return item
  return { ...item, images: item.images.map(expandImageVariants) }
}
