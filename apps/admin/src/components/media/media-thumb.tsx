import { Picture } from '@commerce/blocks/media'
import { cn } from '@commerce/ui/lib/utils'
import { isVideoMedia, type MediaItem } from './media-pick-types'

type MediaThumbProps = {
  item: Pick<MediaItem, 'url' | 'alt' | 'contentType' | 'variants' | 'thumbhash'>
  /** Decorative inside a labelled button; the button carries the name. */
  alt?: string
  className?: string
}

/**
 * A library file as a thumbnail: the media pipeline's `<Picture>` (smallest
 * AVIF/WebP that fits, ThumbHash blur while it loads) for images, a muted
 * first frame for videos.
 */
export default function MediaThumb({ item, alt = '', className }: MediaThumbProps) {
  // Early returns
  if (isVideoMedia(item.contentType)) {
    return <video src={item.url} muted playsInline className={cn('size-full', className)} />
  }

  // Render logic
  return (
    <Picture
      image={{ url: item.url, alt: item.alt, variants: item.variants, thumbhash: item.thumbhash }}
      alt={alt}
      width={160}
      height={160}
      sizes="10rem"
      className={cn('size-full', className)}
    />
  )
}
