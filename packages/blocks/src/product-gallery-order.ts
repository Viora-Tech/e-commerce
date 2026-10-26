/**
 * SOURCE OF TRUTH KEYWORDS: variant gallery order, galleryForVariant
 * WHAT:  The product page gallery for the picked variant: that variant's own images first, in
 *        the order the merchant set, then the rest of the product's images as they were.
 * WHY:   A variant can hold several photos (Black shows its three). Picking it should bring
 *        them to the front without hiding the others; a product whose variants have no images
 *        keeps its gallery exactly as it was.
 */
import type { MediaImage, ProductDetail } from './types'

type GalleryVariant = Pick<ProductDetail['variants'][number], 'imageUrl' | 'imageUrls'>

/** The variant's image urls in order; an older payload with only `imageUrl` reads as one. */
export function variantImageUrls(variant: GalleryVariant | undefined): string[] {
  if (!variant) return []
  if (variant.imageUrls && variant.imageUrls.length > 0) return variant.imageUrls
  return variant.imageUrl ? [variant.imageUrl] : []
}

/**
 * Gallery images for the picked variant: its own images first (those the product gallery holds),
 * the rest after in their gallery order. Unchanged when the variant has none.
 */
export function galleryForVariant(
  images: MediaImage[],
  variant: GalleryVariant | undefined,
): MediaImage[] {
  const urls = variantImageUrls(variant)
  if (urls.length < 2) return images
  const own = urls.flatMap((url) => images.find((i) => i.url === url) ?? [])
  if (own.length === 0) return images
  return [...own, ...images.filter((i) => !own.includes(i))]
}

/** The slide to show for the variant in `galleryForVariant`'s order: its main image, else the first. */
export function slideForVariant(images: MediaImage[], variant: GalleryVariant | undefined): number {
  const main = variantImageUrls(variant)[0]
  return Math.max(
    0,
    images.findIndex((i) => i.url === main),
  )
}
