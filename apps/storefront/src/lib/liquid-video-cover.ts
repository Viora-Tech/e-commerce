/**
 * Hero videos without their cover picture, for shoppers. Owner, 17 Nov 2026: a theme's hero
 * video `poster` (Waimers' Zero Drift slide 1, the Lofree keyboard picture) is the theme's
 * picture on the Themes page, not something shoppers should see in place of the video.
 *
 * In an above-the-fold section, a background video (no `controls`) keeps its cover only as
 * `data-cover`, which nothing on the page draws and Customize's theme picture still reads
 * (`apps/admin/src/lib/capture-theme-thumbnail.ts`); the first such video that waited for the
 * theme's script (`preload="none"`) starts loading at once, so the dark moment before it plays
 * stays short (the smaller copies of `video-compact` help too). A video with controls is a
 * player the shopper starts, so its cover stays; below-the-fold videos keep theirs too, since
 * they load only near the viewport (`liquid-fold.ts`). Pure string work, safe to run twice.
 */

import { attributes, openTag, tag } from './liquid-fold'
import { AUTO_POSTER_ATTR } from './liquid-video-poster'

const VIDEO = tag('video')

/** The cover a video had before the storefront took it away. */
export const COVER_ATTR = 'data-cover'

/** `html` with each background video's cover moved out of sight, the first one loading early. */
export function withoutVideoCovers(html: string): string {
  if (!/<video\b/i.test(html)) return html
  let first = true
  return html.replace(VIDEO, (whole, name: string, source: string) => {
    const attrs = attributes(source)
    const has = (n: string) => attrs.some((a) => a.name === n)
    const poster = attrs.find((a) => a.name === 'poster')
    // A first-frame poster the storefront added (`./liquid-video-poster.ts`) is not a cover.
    if (has('controls') || !poster || has(AUTO_POSTER_ATTR)) return whole
    const eq = poster.raw.indexOf('=')
    const value = eq < 0 ? '' : poster.raw.slice(eq + 1).trim()
    const kept = attrs.filter((a) => a !== poster && a.name !== COVER_ATTR)
    const cover = value ? [{ name: COVER_ATTR, raw: `${COVER_ATTR}=${value}` }] : []
    const lazy = attrs.find((a) => a.name === 'preload')?.raw.match(/=\s*["']?none/i)
    const loading = first && lazy
    first = false
    const next = loading
      ? kept.map((a) => (a.name === 'preload' ? { name: 'preload', raw: 'preload="auto"' } : a))
      : kept
    return openTag(name, [...next, ...cover])
  })
}
