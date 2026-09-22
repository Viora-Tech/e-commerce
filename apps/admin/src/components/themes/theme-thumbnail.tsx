'use client'

import { themesContent as copy } from '@/data/themes'
import { previewUrl } from './theme-types'

type ThemeThumbnailProps = {
  name: string
  origin: string
  previewToken: string
}

/**
 * The storefront home page, rendered with this theme and scaled down to a card. The
 * frame is inert (no pointer events, out of the tab order); it is a picture.
 */
export default function ThemeThumbnail({ name, origin, previewToken }: ThemeThumbnailProps) {
  // Render logic
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md border border-border bg-muted">
      <iframe
        src={previewUrl(origin, previewToken)}
        title={copy.library.thumbnail(name)}
        tabIndex={-1}
        loading="lazy"
        className="pointer-events-none absolute top-0 left-0 h-[400%] w-[400%] origin-top-left scale-25 border-0 bg-card"
      />
    </div>
  )
}
