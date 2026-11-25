/**
 * SOURCE OF TRUTH KEYWORDS: first-frame video poster, hero LCP, poster preload
 * WHAT:  A theme video with no poster of its own gets the video's poster from Files (the
 *        worker's first-frame WebP, `@commerce/core` compact-video `videoPosterKey`, or the one
 *        the merchant picked). The page's first video (the hero's first slide) gets it as a real
 *        `poster` plus `<link rel="preload" as="image" fetchpriority="high">`; a later video gets
 *        it as `data-poster`, lazy like Glide's own slides 2 and 3 (the theme's carousel and the
 *        fallback script, `liquid-video-fallback.ts`, show it when needed).
 * WHY:   25 Nov 2026, www.waimers.in: LCP 5.1 s, the LCP element was slide 1's `<video
 *        preload="none">` with no poster, so LCP waited for a 4.7 MB (phone) / 9.3 MB video.
 *        Shopify renders `poster="…preview_images/<id>.thumbnail.0000000000.jpg"` on every hero
 *        video and its LCP fires on that poster.
 * A video with a phone source (`<source media="(max-width: 749px)">`) and a desktop source has a
 * poster for each: both are preloaded under their media query, and a tiny inline script right
 * after the video sets the matching one as its `poster` while the page is parsed (a `poster`
 * attribute cannot switch by media query, and writing the desktop one would fetch it on phones).
 * A video that already has a `poster` keeps it. A background video whose theme cover
 * `liquid-video-cover.ts` moved to `data-cover` (owner, 17 Nov 2026: the theme's picture is not
 * shown to shoppers) gets the video's own first frame, never the theme's picture.
 * Pure string work, applied before the render is cached; safe to run twice.
 */

import { attributes, openTag } from './liquid-fold'

/** Marks a poster the storefront added: never treated as the theme's cover. */
export const AUTO_POSTER_ATTR = 'data-auto-poster'

const MOBILE_ATTR = 'data-auto-poster-mobile'
const MEDIA_ATTR = 'data-auto-poster-media'

/** A whole `<video>` element: group 1 its attributes, group 2 what is inside. */
const VIDEO_ELEMENT = /<video\b((?:[^>"']|"[^"]*"|'[^']*')*?)\s*>([\s\S]*?)<\/video\s*>/gi
const SOURCE = /<source\b((?:[^>"']|"[^"]*"|'[^']*')*?)\s*\/?>/gi

/** Sets the poster that matches the phone media query, while the page is parsed. */
const PICK_SCRIPT =
  "(function(v){if(!v||v.getAttribute('poster'))return;" +
  `var m=v.getAttribute('${MOBILE_ATTR}'),q=v.getAttribute('${MEDIA_ATTR}');` +
  `v.setAttribute('poster',m&&q&&matchMedia(q).matches?m:v.getAttribute('${AUTO_POSTER_ATTR}'))})` +
  '(document.currentScript&&document.currentScript.previousElementSibling)'

const escapeAttr = (v: string) =>
  v
    .replace(/&(?!amp;|quot;|#)/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')

/** An attribute's value as written (quotes off, `&amp;` back to `&`), or null. */
function attrValue(raw: string | undefined): string | null {
  if (!raw) return null
  const eq = raw.indexOf('=')
  if (eq < 0) return ''
  return raw
    .slice(eq + 1)
    .trim()
    .replace(/^(["'])([\s\S]*)\1$/, '$2')
    .replace(/&amp;/g, '&')
}

const attr = (name: string, value: string) => ({ name, raw: `${name}="${escapeAttr(value)}"` })

function preload(href: string, media: string | null): string {
  const scoped = media ? ` media="${escapeAttr(media)}"` : ''
  return `<link rel="preload" as="image" fetchpriority="high" href="${escapeAttr(href)}"${scoped}>`
}

/** The phone and desktop files of one video: its `src`, or its `<source>` children. */
function filesOf(attrs: ReturnType<typeof attributes>, inner: string) {
  const own = attrValue(attrs.find((a) => a.name === 'src')?.raw)
  const sources = [...inner.matchAll(SOURCE)].map((m) => {
    const a = attributes(m[1] ?? '')
    return {
      src: attrValue(a.find((x) => x.name === 'src')?.raw),
      media: attrValue(a.find((x) => x.name === 'media')?.raw),
    }
  })
  const phone = sources.find((s) => s.src && s.media) ?? null
  const desktop = own ?? [...sources].reverse().find((s) => s.src && !s.media)?.src ?? null
  return { desktop, phone }
}

/**
 * `html` with each poster-less video carrying its poster from `posters` (video address → poster
 * address; either the original's or its smaller copy's address may be the key). `lcp`: the
 * first such video is the page's first (the caller knows), so it gets the eager treatment.
 */
export function withVideoPosters(
  html: string,
  posters: ReadonlyMap<string, string>,
  opts: { lcp: boolean; nonceMark: string },
): string {
  if (posters.size === 0 || !/<video\b/i.test(html)) return html
  let first = opts.lcp
  return html.replace(VIDEO_ELEMENT, (whole, source: string, inner: string) => {
    const attrs = attributes(source)
    const has = (n: string) => attrs.some((a) => a.name === n)
    const eager = first
    first = false
    if (has('poster') || has(AUTO_POSTER_ATTR)) return whole
    const { desktop, phone } = filesOf(attrs, inner)
    const desktopPoster = desktop ? posters.get(desktop) : undefined
    const phonePoster = phone?.src ? posters.get(phone.src) : undefined
    const main = desktopPoster ?? phonePoster
    if (!main) return whole
    const close = whole.slice(whole.lastIndexOf('<'))
    const body = `${inner}${close}`
    if (!eager) {
      if (has('data-poster')) return whole
      return (
        openTag('video', [...attrs, attr('data-poster', main), attr(AUTO_POSTER_ATTR, main)]) + body
      )
    }
    const query = phone?.media ?? null
    // `not all and (…)` cannot negate a list of queries: one poster for both then.
    const split =
      desktopPoster && phonePoster && desktopPoster !== phonePoster && query && !/,/.test(query)
    if (!split) {
      return `${preload(main, null)}${openTag('video', [...attrs, attr('poster', main), attr(AUTO_POSTER_ATTR, main)])}${body}`
    }
    const links = preload(phonePoster, query) + preload(desktopPoster, `not all and ${query}`)
    const tagged = openTag('video', [
      ...attrs,
      attr(AUTO_POSTER_ATTR, desktopPoster),
      attr(MOBILE_ATTR, phonePoster),
      attr(MEDIA_ATTR, query),
    ])
    return `${links}${tagged}${body}<script nonce="${opts.nonceMark}">${PICK_SCRIPT}</script>`
  })
}
