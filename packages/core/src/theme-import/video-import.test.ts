/** SOURCE OF TRUTH: Shopify video import tests (theme side) — WHAT: the live home page's video markup read into main + phone mp4s, file-name matching, the `video` setting as a Liquid object with renditions, `video_tag` / `media_tag` output, the `video` editor field / WHY: the owner's hero carousel videos came over empty; each link of that chain is pinned here with markup copied from the real storefront (no network) */
import { describe, expect, it } from 'vitest'
import { fakeDataSource } from '../../test/theme-import-fixture'
import { LiquidDataCache } from './cache'
import { VideoDrop } from './drops'
import { createThemeEngine } from './engine'
import { liquidSectionFields } from './fields'
import { liveVideosIn } from './import-media'
import { liquidSettingValue } from './settings-values'

const HERO =
  '<section id="shopify-section-template--29173672771750__hero" class="shopify-section">' +
  '<video\n class="hero-carousel__video"\n muted\n loop\n playsinline\n preload="none"\n \n   data-poster="//waimers.in/cdn/shop/files/preview_images/e05e.thumbnail.0000000000.jpg?v=1&width=1920"\n \n>' +
  '<source src="//waimers.in/cdn/shop/videos/c/vp/e05e/e05e.HD-720p-4.5Mbps-95871546.mp4?v=0" type="video/mp4" media="(max-width: 749px)">' +
  '<source src="//waimers.in/cdn/shop/videos/c/vp/e05e/e05e.HD-1080p-7.2Mbps-95871546.mp4?v=0" type="video/mp4">\n</video></section>' +
  '<section id="shopify-section-template--29173672771750__promo_bento_ERWCtg">' +
  '<video class="promo-tile__video" muted loop><source src="//waimers.in/cdn/shop/videos/c/vp/1631/1631.SD-480p-1.5Mbps-1.mp4?v=0" type="video/mp4" media="(max-width: 749px)"><source src="//waimers.in/cdn/shop/videos/c/vp/1631/1631.HD-720p-4.5Mbps-1.mp4?v=0" type="video/mp4"></video></section>'

const runtime = {
  locale: {},
  currency: 'INR',
  moneyFormat: null,
  fonts: new Map(),
  nonce: '',
  shopifyHost: null,
  assetUrl: (f: string) => f,
  assetText: () => null,
}
const render = (src: string, data: Record<string, unknown>) =>
  createThemeEngine(new Map()).parseAndRenderSync(src, data, { globals: { _rt: runtime } })

describe('reading the live page', () => {
  it('takes the tallest mp4 as the main file, the media-query one for phones, and data-poster', () => {
    expect(liveVideosIn(HERO, 'hero')).toEqual([
      {
        src: 'https://waimers.in/cdn/shop/videos/c/vp/e05e/e05e.HD-1080p-7.2Mbps-95871546.mp4?v=0',
        mobileSrc:
          'https://waimers.in/cdn/shop/videos/c/vp/e05e/e05e.HD-720p-4.5Mbps-95871546.mp4?v=0',
        poster:
          'https://waimers.in/cdn/shop/files/preview_images/e05e.thumbnail.0000000000.jpg?v=1&width=1920',
      },
    ])
    expect(liveVideosIn(HERO, 'promo_bento_ERWCtg')[0]).toMatchObject({
      src: expect.stringContaining('HD-720p'),
      mobileSrc: expect.stringContaining('SD-480p'),
    })
  })
})

describe('a video setting in Liquid', () => {
  const cache = new LiquidDataCache(fakeDataSource(), [])
  const value = {
    url: 'https://cdn.example/hero-1080.mp4',
    mobileUrl: 'https://cdn.example/hero-720.mp4',
    poster: { url: 'https://cdn.example/poster.jpg', width: 1920, height: 1080 },
  }
  const video = liquidSettingValue({ type: 'video', id: 'video' }, value, cache, {})

  it('lists both renditions by height, so the hero theme picks phone and desktop files', () => {
    expect(video).toBeInstanceOf(VideoDrop)
    const out = render(
      '{% for s in v.sources %}{{ s.height }}={{ s.url }};{% endfor %}{{ v.preview_image.src }}',
      { v: video },
    )
    expect(out).toContain('1080=https://cdn.example/hero-1080.mp4;')
    expect(out).toContain('720=https://cdn.example/hero-720.mp4;')
    expect(out).toContain('https://cdn.example/poster.jpg')
  })

  it('video_tag and media_tag print every source, the poster and the flags', () => {
    for (const tag of [
      '{{ v | video_tag: autoplay: true, loop: true, muted: true }}',
      '{{ v | media_tag }}',
    ]) {
      const html = render(tag, { v: video })
      expect(html).toContain(
        '<source src="https://cdn.example/hero-720.mp4" type="video/mp4" media="(max-width: 749px)">',
      )
      expect(html).toContain('<source src="https://cdn.example/hero-1080.mp4" type="video/mp4">')
      expect(html).toContain('poster="https://cdn.example/poster.jpg')
      expect(html).toContain('playsinline')
    }
    expect(
      render('{{ v | video_tag: autoplay: true, loop: true, muted: true }}', { v: video }),
    ).toMatch(/autoplay="autoplay".*loop="loop".*muted="muted"/)
  })

  it('a video with one file prints one plain source', () => {
    const one = liquidSettingValue(
      { type: 'video', id: 'v' },
      { url: 'https://cdn.example/a.mp4' },
      cache,
      {},
    )
    expect(render('{{ v | video_tag }}', { v: one })).toBe(
      '<video playsinline="true" preload="metadata"><source src="https://cdn.example/a.mp4" type="video/mp4"></video>',
    )
  })

  it('is empty, not broken, when the video was not copied', () => {
    expect(liquidSettingValue({ type: 'video', id: 'v' }, '', cache, {})).toBeNull()
  })
})

describe('the editor field for a video setting', () => {
  it('is an object with the file address and poster, not a text box over an object', () => {
    const fields = liquidSectionFields(
      { name: 'Hero', settings: [{ type: 'video', id: 'video', label: 'Video' }] },
      {},
    )
    expect(fields.video).toMatchObject({
      type: 'object',
      objectFields: { url: { type: 'text' }, poster: { type: 'object' } },
    })
  })
})
