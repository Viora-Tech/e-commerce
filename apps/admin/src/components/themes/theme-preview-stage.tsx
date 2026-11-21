'use client'

import type { Theme } from '@commerce/core/theme'
import { useState } from 'react'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { useShownPicture } from '@/lib/use-shown-picture'
import ThemeSwatch from './theme-swatch'

type ThemePreviewStageProps = {
  name: string
  origin: string
  settings: Theme
  /**
   * The home page picture Customize took on Save; a swatch in the theme's colours until then, or
   * when the stored picture is blank.
   */
  picture: string | null
  /**
   * The saved home page's first picture (the hero's poster), shown while there is no screenshot;
   * the swatch is the last resort.
   */
  cover?: string | null | undefined
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
  picture: stored,
  cover = null,
}: ThemePreviewStageProps) {
  // Hooks
  const copy = useCopy(themesContent.library)
  const shown = useShownPicture(stored)
  // Addresses that failed to load (a file missing from storage, a host that cannot serve it
  // here): each one drops to the next picture, so the stage never shows a broken image.
  const [failed, setFailed] = useState<readonly string[]>([])

  // Handlers
  const handleError = (src: string) => {
    console.warn('Theme picture did not load, showing the next one:', src)
    setFailed((list) => (list.includes(src) ? list : [...list, src]))
  }
  // A picture that failed while the page was still loading (before React attached onError)
  // never fires the event again: it is complete with no size, so treat it as failed here.
  const handlePictureRef = (img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth === 0 && img.getAttribute('src')) {
      handleError(img.getAttribute('src') ?? '')
    }
  }

  // Render logic
  const shot = shown && !failed.includes(shown) ? shown : null
  const usableCover = cover && !failed.includes(cover) ? cover : null
  const picture = shot ?? usableCover
  // A cover is a photo, not a page: it fills both frames instead of shrinking into the phone.
  const isCover = !shot && Boolean(usableCover)
  const hint = isCover ? copy.coverHint : copy.pictureHint
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
            <span className="mx-auto max-w-[60%] flex-1 truncate rounded-md bg-muted px-3 py-0.5 text-center text-micro text-muted-foreground">
              {host}
            </span>
          </div>
          <div className="relative aspect-[1440/1080] overflow-hidden bg-card">
            {picture ? (
              // biome-ignore lint/performance/noImgElement: a small stored webp from the store's storage.
              <img
                src={picture}
                alt={copy.thumbnail(name)}
                title={hint}
                ref={handlePictureRef}
                onError={() => handleError(picture)}
                loading="lazy"
                decoding="async"
                className={isCover ? 'size-full object-cover' : 'size-full object-cover object-top'}
              />
            ) : (
              <span role="img" aria-label={copy.thumbnail(name)} title={hint}>
                <ThemeSwatch
                  theme={settings}
                  name={name}
                  className="absolute inset-0 border-0 p-8"
                />
              </span>
            )}
          </div>
        </div>
        <div
          className="absolute right-[-1.5rem] bottom-0 hidden w-[10.5rem] overflow-hidden rounded-[1.75rem] border-[0.3125rem] border-foreground/80 bg-card shadow-2xl sm:block"
          aria-hidden="true"
        >
          <div className="relative aspect-[390/800] overflow-hidden">
            {picture ? (
              // biome-ignore lint/performance/noImgElement: a small stored webp from the store's storage.
              <img
                src={picture}
                alt=""
                ref={handlePictureRef}
                onError={() => handleError(picture)}
                loading="lazy"
                decoding="async"
                className={
                  isCover
                    ? 'size-full bg-card object-cover'
                    : 'size-full bg-card object-contain object-top'
                }
              />
            ) : (
              <ThemeSwatch theme={settings} name={name} className="absolute inset-0 border-0 p-4" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
