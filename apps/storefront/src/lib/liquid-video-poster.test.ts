import { describe, expect, it } from 'vitest'
import { withoutVideoCovers } from './liquid-video-cover'
import { AUTO_POSTER_ATTR, withVideoPosters } from './liquid-video-poster'

const DESK = 'https://cdn.test/stores/s/media/hero.small.mp4'
const PHONE = 'https://cdn.test/stores/s/media/hero-m.small.mp4'
const DESK_POSTER = 'https://cdn.test/stores/s/media/hero.poster.webp'
const PHONE_POSTER = 'https://cdn.test/stores/s/media/hero-m.poster.webp'
const posters = new Map([
  [DESK, DESK_POSTER],
  [PHONE, PHONE_POSTER],
])
const opts = { lcp: true, nonceMark: 'NONCE' }

const slide = (attrs: string, sources: string) =>
  `<video class="hero-carousel__video" muted loop playsinline preload="none" autoplay${attrs}>${sources}</video>`
const both =
  `<source src="${PHONE}" type="video/mp4" media="(max-width: 749px)">` +
  `<source src="${DESK}" type="video/mp4">`

describe('withVideoPosters', () => {
  it('gives the first video a real poster and a high-priority preload', () => {
    const out = withVideoPosters(
      slide('', `<source src="${DESK}" type="video/mp4">`),
      posters,
      opts,
    )
    expect(
      out.startsWith(`<link rel="preload" as="image" fetchpriority="high" href="${DESK_POSTER}">`),
    ).toBe(true)
    expect(out).toContain(`poster="${DESK_POSTER}"`)
    expect(out).toContain(AUTO_POSTER_ATTR)
    expect(out).not.toContain('<script')
  })

  it('preloads the phone and desktop posters under their media query and picks one on parse', () => {
    const out = withVideoPosters(slide('', both), posters, opts)
    expect(out).toContain(`href="${PHONE_POSTER}" media="(max-width: 749px)"`)
    expect(out).toContain(`href="${DESK_POSTER}" media="not all and (max-width: 749px)"`)
    expect(out).not.toMatch(/\sposter=/) // set by the script, so a phone never fetches the desktop one
    expect(out).toMatch(/<\/video><script nonce="NONCE">.*matchMedia/)
  })

  it('leaves later videos lazy: data-poster, no preload, a theme data-poster untouched', () => {
    const second = slide(' data-poster="https://theme.test/s2.jpg"', both)
    const third = slide('', `<source src="${DESK}">`)
    const out = withVideoPosters(slide('', both) + second + third, posters, opts)
    expect(out.match(/rel="preload"/g)).toHaveLength(2) // the first video's two only
    expect(out).toContain(second)
    expect(out).toContain(`data-poster="${DESK_POSTER}"`)
  })

  it('keeps a poster the video already has, and counts it as the first video', () => {
    const own = slide(' poster="https://cdn.test/merchant.jpg"', both)
    const out = withVideoPosters(own + slide('', both), posters, opts)
    expect(out.startsWith(own)).toBe(true)
    expect(out).not.toContain('rel="preload"')
  })

  it('does nothing below the first section, without posters, and on a second run', () => {
    const html = slide('', both)
    expect(withVideoPosters(html, posters, { ...opts, lcp: false })).not.toContain('preload"')
    expect(withVideoPosters(html, new Map(), opts)).toBe(html)
    const once = withVideoPosters(html, posters, opts)
    expect(withVideoPosters(once, posters, opts)).toBe(once)
  })

  it('is not taken for a cover when the cover pass runs again on a cached render', () => {
    const once = withVideoPosters(slide('', `<source src="${DESK}">`), posters, opts)
    expect(withoutVideoCovers(once)).toBe(once)
  })

  it('escapes the ampersand of a poster address', () => {
    const q = `${DESK_POSTER}?v=1&w=2`
    const out = withVideoPosters(slide('', `<source src="${DESK}">`), new Map([[DESK, q]]), opts)
    expect(out).toContain('poster="https://cdn.test/stores/s/media/hero.poster.webp?v=1&amp;w=2"')
  })
})
