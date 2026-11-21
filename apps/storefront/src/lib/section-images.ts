/**
 * Section image settings are saved as `{ url, alt, focal? }`: the editor keeps the
 * media library's AVIF/WebP variants and ThumbHash out of the theme JSON. Before a
 * template renders, the storefront finds every such image in the section props,
 * looks the URLs up once (`media-lookup.ts`) and hands the variants back, so the
 * blocks can draw `<Picture>` instead of the full-size original. Pure: no database.
 */

export type ImageMedia = {
  variants: Record<string, { avif: string; webp: string }> | null
  thumbhash: string | null
  width: number | null
  height: number | null
}

/** More than any real template holds; a bound on the lookup's `IN (...)` list. */
export const MAX_LOOKUP_URLS = 200

type ImageValue = { url: string; alt?: unknown; variants?: unknown }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** An image setting as the picker saves it: a non-empty `url` beside an `alt`. */
function isImageValue(value: unknown): value is ImageValue {
  return isRecord(value) && typeof value.url === 'string' && value.url !== '' && 'alt' in value
}

/** Every image URL in a template's section props (deduplicated, capped). */
export function collectImageUrls(value: unknown): string[] {
  const found = new Set<string>()
  const walk = (v: unknown): void => {
    if (found.size >= MAX_LOOKUP_URLS) return
    if (Array.isArray(v)) {
      for (const item of v) walk(item)
      return
    }
    if (!isRecord(v)) return
    if (isImageValue(v) && v.variants === undefined) found.add(v.url)
    for (const child of Object.values(v)) walk(child)
  }
  walk(value)
  return [...found]
}

/**
 * The same value with each image setting the library knows gaining `variants` and
 * `thumbhash`. Copies only along the paths it changes; everything else is shared.
 * Images the library does not know (external URLs, legacy uploads) are left as saved.
 */
export function withImageMedia<T>(value: T, media: ReadonlyMap<string, ImageMedia>): T {
  if (media.size === 0) return value
  const map = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      let changed = false
      const next = v.map((item) => {
        const mapped = map(item)
        if (mapped !== item) changed = true
        return mapped
      })
      return changed ? next : v
    }
    if (!isRecord(v)) return v
    let out: Record<string, unknown> = v
    const found = isImageValue(v) && v.variants === undefined ? media.get(v.url) : undefined
    if (found?.variants || found?.thumbhash) {
      out = { ...v, variants: found.variants, thumbhash: found.thumbhash }
    }
    for (const [key, child] of Object.entries(v)) {
      const mapped = map(child)
      if (mapped !== child) {
        if (out === v) out = { ...v }
        out[key] = mapped
      }
    }
    return out
  }
  return map(value) as T
}

/** The height that keeps a media file's aspect ratio at `width`, when its size is known. */
export function heightForWidth(
  size: Pick<ImageMedia, 'width' | 'height'> | undefined,
  width: number,
): number | undefined {
  if (!size?.width || !size.height) return undefined
  return Math.round((width * size.height) / size.width)
}

/** A section's video address: `url` (Video) or `videoUrl` (Video hero, hero slides). */
const VIDEO_KEYS = ['videoUrl', 'url'] as const

/** An image setting left empty in the editor (`{ url: '', alt: '' }`), or no poster at all. */
function isEmptyImage(value: unknown): boolean {
  return value === undefined || (isRecord(value) && (value.url === '' || value.url === undefined))
}

/** The video a section with an empty `poster` plays, if it names one. */
function videoNeedingPoster(v: Record<string, unknown>): string | null {
  if (!('poster' in v) || !isEmptyImage(v.poster)) return null
  for (const key of VIDEO_KEYS) {
    const url = v[key]
    if (typeof url === 'string' && url.startsWith('https://')) return url
  }
  return null
}

/**
 * Videos in a template whose section left the poster empty (deduplicated, capped). Their
 * poster in Files (picked on upload, `@commerce/core` `media/poster.ts`) fills the gap, so a
 * built-in Video section shows a real frame instead of a black first frame while it loads.
 */
export function collectVideosWithoutPoster(value: unknown): string[] {
  const found = new Set<string>()
  const walk = (v: unknown): void => {
    if (found.size >= MAX_LOOKUP_URLS) return
    if (Array.isArray(v)) {
      for (const item of v) walk(item)
      return
    }
    if (!isRecord(v)) return
    const video = videoNeedingPoster(v)
    if (video) found.add(video)
    for (const child of Object.values(v)) walk(child)
  }
  walk(value)
  return [...found]
}

/** A video's poster picture as a section image setting, variants included. */
export type PosterImage = ImageMedia & { url: string }

/** The same value with each empty `poster` beside a known video filled with that video's poster. */
export function withVideoPosters<T>(value: T, posters: ReadonlyMap<string, PosterImage>): T {
  if (posters.size === 0) return value
  const map = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      let changed = false
      const next = v.map((item) => {
        const mapped = map(item)
        if (mapped !== item) changed = true
        return mapped
      })
      return changed ? next : v
    }
    if (!isRecord(v)) return v
    let out: Record<string, unknown> = v
    const video = videoNeedingPoster(v)
    const poster = video ? posters.get(video) : undefined
    if (poster) {
      const alt = isRecord(v.poster) && typeof v.poster.alt === 'string' ? v.poster.alt : ''
      out = { ...v, poster: { ...(isRecord(v.poster) ? v.poster : {}), ...poster, alt } }
    }
    for (const [key, child] of Object.entries(v)) {
      if (key === 'poster' && out !== v) continue
      const mapped = map(child)
      if (mapped !== child) {
        if (out === v) out = { ...v }
        out[key] = mapped
      }
    }
    return out
  }
  return map(value) as T
}

/** An address that names an MP4/MOV/M4V/WebM file (as `isVideoUrl` in `@commerce/core`). */
const VIDEO_URL = /^https?:\/\/[^\s]+\.(mp4|mov|m4v|webm)(\?|#|$)/i

/**
 * Every video address in a template's section props (deduplicated, capped), whatever the
 * setting is called (`url`, `videoUrl`, `file`, `video`, `videoSrc`...): any string that names a
 * video file. Each may have a smaller copy in Files (`@commerce/core` compact-video).
 */
export function collectVideoUrls(value: unknown): string[] {
  const found = new Set<string>()
  const walk = (v: unknown): void => {
    if (found.size >= MAX_LOOKUP_URLS) return
    if (typeof v === 'string') {
      if (VIDEO_URL.test(v)) found.add(v)
      return
    }
    if (Array.isArray(v)) {
      for (const item of v) walk(item)
      return
    }
    if (isRecord(v)) for (const child of Object.values(v)) walk(child)
  }
  walk(value)
  return [...found]
}

/**
 * The same value with every string equal to a video address that has a smaller copy swapped
 * for the copy. Copies only along the paths it changes. A video without a copy (not made yet,
 * or not worth it) keeps its original address, so it always plays.
 */
export function withSmallVideos<T>(value: T, copies: ReadonlyMap<string, string>): T {
  if (copies.size === 0) return value
  const map = (v: unknown): unknown => {
    if (typeof v === 'string') return copies.get(v) ?? v
    if (Array.isArray(v)) {
      let changed = false
      const next = v.map((item) => {
        const mapped = map(item)
        if (mapped !== item) changed = true
        return mapped
      })
      return changed ? next : v
    }
    if (!isRecord(v)) return v
    let out: Record<string, unknown> = v
    for (const [key, child] of Object.entries(v)) {
      const mapped = map(child)
      if (mapped !== child) {
        if (out === v) out = { ...v }
        out[key] = mapped
      }
    }
    return out
  }
  return map(value) as T
}
