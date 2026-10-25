'use client'

import type { Theme } from '@commerce/core/theme'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import ThemeSwatch from './theme-swatch'

type ThemePreviewStageProps = {
  name: string
  origin: string
  settings: Theme
  /** The home page picture Customize took on Save; a swatch in the theme's colours until then. */
  picture: string | null
}

/**
 * Figma "Current theme › Preview" (683:78386): the storefront in a desktop browser frame with a
 * phone frame overlapping its right edge, on the card's stage. Static on purpose: two live
 * storefront frames made the page lag, so the live page opens only from Preview or Customize.
 */
export default function ThemePreviewStage({
  name,
  origin,
  settings,
  picture,
}: ThemePreviewStageProps) {
  // Hooks
  const copy = useCopy(themesContent.library)

  // Render logic
  const host = origin.replace(/^https?:\/\//, '')

  return (
    <div className="relative flex justify-center overflow-hidden border-b border-border bg-muted/40 px-6 pt-8 pb-0 md:px-10">
      <div className="relative w-full max-w-[41rem] pb-10">
        <div className="overflow-hidden rounded-t-xl border border-border bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="flex gap-1" aria-hidden="true">
              <span className="size-2 rounded-full bg-muted-foreground/30" />
              <span className="size-2 rounded-full bg-muted-foreground/30" />
              <span className="size-2 rounded-full bg-muted-foreground/30" />
            </span>
            <span className="mx-auto max-w-[60%] flex-1 truncate rounded-md bg-muted px-3 py-0.5 text-center text-[0.6875rem] text-muted-foreground">
              {host}
            </span>
          </div>
          <div className="relative aspect-[1440/1080] overflow-hidden bg-card">
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
              <span role="img" aria-label={copy.thumbnail(name)} title={copy.pictureHint}>
                <ThemeSwatch theme={settings} className="absolute inset-0 border-0 p-8" />
              </span>
            )}
          </div>
        </div>
        <div
          className="absolute right-[-1.5rem] bottom-0 hidden w-[10.5rem] overflow-hidden rounded-[1.75rem] border-[5px] border-foreground/80 bg-card shadow-2xl sm:block"
          aria-hidden="true"
        >
          <div className="relative aspect-[390/800] overflow-hidden">
            {picture ? (
              // biome-ignore lint/performance/noImgElement: a small stored webp from the store's storage.
              <img
                src={picture}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-full bg-card object-contain object-top"
              />
            ) : (
              <ThemeSwatch theme={settings} className="absolute inset-0 border-0 p-4" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
