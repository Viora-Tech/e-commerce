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
