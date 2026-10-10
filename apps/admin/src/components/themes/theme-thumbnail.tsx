'use client'

import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { previewUrl } from './theme-types'

type ThemeThumbnailProps = {
  name: string
  origin: string
  previewToken: string
  /** The home page picture Customize took on Save; null until the theme's first one. */
  picture: string | null
}

/**
 * The storefront home page with this theme, in the live theme card's framed well (Figma "Theme
 * preview"). The picture Customize took on Save when there is one; until then the page itself,
 * scaled down in an inert frame (no pointer events, out of the tab order).
 */
export default function ThemeThumbnail({
  name,
  origin,
  previewToken,
  picture,
}: ThemeThumbnailProps) {
  // Hooks
  const copy = useCopy(themesContent.library)

  // Render logic
  return (
    <div className="aspect-[420/260] w-full shrink-0 overflow-hidden rounded-xl border border-border bg-muted p-3 md:w-[26.25rem] md:p-4">
      <div className="relative size-full overflow-hidden rounded-lg bg-card shadow-sm ring-1 ring-border">
        {picture ? (
          // biome-ignore lint/performance/noImgElement: a small stored webp from the store's storage.
          <img
            src={picture}
            alt={copy.thumbnail(name)}
            title={copy.pictureHint}
            loading="lazy"
            decoding="async"
            className="size-full object-cover object-top"
          />
        ) : (
          <iframe
            src={previewUrl(origin, previewToken)}
            title={copy.thumbnail(name)}
            tabIndex={-1}
            loading="lazy"
            className="pointer-events-none absolute top-0 left-0 h-[400%] w-[400%] origin-top-left scale-25 border-0 bg-card"
          />
        )}
      </div>
    </div>
  )
}
