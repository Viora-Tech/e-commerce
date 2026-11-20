/**
 * SOURCE OF TRUTH: a theme's cover — WHAT: the first picture of a saved home page (the hero's
 * video poster, else its image), read from the template's stored sections / WHY: the Themes page
 * shows it when no screenshot of the theme exists yet (Customize photographs only a saved home
 * page, and the worker's headless shot needs Chromium), instead of a colour swatch.
 *
 * Saved sections only, never the draft: the cover shows what shoppers see, not unsaved edits.
 */

/** Only the top of the page: the hero is first; an announcement strip can sit above it. */
const SECTIONS_LOOKED_AT = 3

/** A picture a browser can load: http(s) or a root path, with an image file extension. */
const IMAGE_URL = /^(https?:\/\/|\/(?!\/))[^\s"'<>]+\.(avif|gif|jpe?g|png|webp)(\?[^\s"'<>]*)?$/i

/** A stored picture field: a URL, or our media shape `{ url, width, height }`. */
function imageUrl(value: unknown): string | null {
  if (typeof value === 'string') return IMAGE_URL.test(value) ? value : null
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return imageUrl((value as { url?: unknown }).url)
  }
  return null
}

/** Every picture in `value`, depth first, posters kept apart so they can win. */
function collect(value: unknown, out: { posters: string[]; images: string[] }, depth = 0): void {
  if (depth > 12 || !value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) collect(item, out, depth + 1)
    return
  }
  for (const [key, child] of Object.entries(value)) {
    const url = imageUrl(child)
    if (url) (key === 'poster' ? out.posters : out.images).push(url)
    else collect(child, out, depth + 1)
  }
}

/**
 * The cover of a saved template: in the first section that has a picture, its first video
 * poster, else its first image. Null when the top of the page has no picture.
 */
export function templateCover(data: unknown): string | null {
  const content = (data as { content?: unknown } | null)?.content
  if (!Array.isArray(content)) return null
  for (const section of content.slice(0, SECTIONS_LOOKED_AT)) {
    if ((section as { props?: { _hidden?: unknown } })?.props?._hidden === true) continue
    const found = { posters: [] as string[], images: [] as string[] }
    collect(section, found)
    const cover = found.posters[0] ?? found.images[0]
    if (cover) return cover
  }
  return null
}
