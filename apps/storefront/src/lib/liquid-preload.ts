/**
 * SOURCE OF TRUTH KEYWORDS: product image preload, AVIF preload, double image download
 * WHAT:  On the product page, a theme's `<link rel="preload" as="image">` for one of our media
 *        variants (`…-w1280.webp`, the theme's `image_url` output) is turned into the AVIF twin
 *        of the same widths, with `type="image/avif"`.
 * WHY:   The product page's gallery is our own `<Picture>` (`packages/blocks`), which offers AVIF
 *        first; the theme's head preloaded the WebP. A phone downloaded the main image twice,
 *        once as WebP (the preload) and once as AVIF (the picture) (Lighthouse, 27 Nov). Every
 *        variant width has both formats (`media.variants`), so the AVIF URLs exist. A browser
 *        without AVIF skips a preload whose `type` it cannot show, and the picture falls back to
 *        its WebP source as before.
 * WHERE: `liquid-theme.ts`, on the layout head of product pages only (other pages draw the
 *        theme's own WebP `<img>`, which the preload matches).
 */

/** One of our media variants as WebP: `…/media/<file>-w<width>.webp`. */
const WEBP_VARIANT = /\/media\/[^\s"'?]+-w\d+\.webp(?=$|[\s"'?,])/g

const PRELOAD_IMAGE =
  /<link\b(?=[^>]*\brel\s*=\s*["']?preload\b)(?=[^>]*\bas\s*=\s*["']?image\b)[^>]*>/gi

/** Image preloads of our WebP variants in `html` as their AVIF twins (see the header). */
export function avifImagePreloads(html: string): string {
  return html.replace(PRELOAD_IMAGE, (tag) => {
    if (/\btype\s*=/i.test(tag)) return tag
    const urls = [...tag.matchAll(/\b(?:href|imagesrcset)\s*=\s*("[^"]*"|'[^']*')/gi)]
      .flatMap((m) => (m[1] ?? '').slice(1, -1).split(','))
      .map((entry) => entry.trim().split(/\s+/)[0] ?? '')
      .filter(Boolean)
    // Every URL must be one of our variants, or the theme's picture may not have an AVIF twin.
    if (!urls.length || !urls.every((u) => new RegExp(WEBP_VARIANT.source).test(u))) return tag
    return tag
      .replace(WEBP_VARIANT, (url) => url.replace(/\.webp$/, '.avif'))
      .replace(/\s*\/?>$/, (end) => ` type="image/avif"${end}`)
  })
}
