import { describe, expect, it } from 'vitest'
import { collectVideoUrls, MAX_LOOKUP_URLS, withSmallVideos } from './section-images'

const HERO = 'https://cdn.example.com/stores/s/media/hero.mp4'
const SMALL = 'https://cdn.example.com/stores/s/media/hero.small.mp4'

describe('collectVideoUrls', () => {
  it('finds video addresses under any setting name, once each', () => {
    const props = {
      content: [
        { type: 'VideoHero', props: { videoUrl: HERO, poster: { url: '', alt: '' } } },
        { type: 'Video', props: { url: HERO } },
        { type: 'Promo', props: { videoSrc: 'https://cdn.example.com/a.webm?v=2' } },
        { type: 'Image', props: { image: { url: 'https://cdn.example.com/a.jpg', alt: '' } } },
      ],
    }
    expect(collectVideoUrls(props)).toEqual([HERO, 'https://cdn.example.com/a.webm?v=2'])
  })

  it('ignores text that only mentions a video and relative paths', () => {
    expect(collectVideoUrls({ text: 'watch hero.mp4 now', src: '/hero.mp4' })).toEqual([])
  })

  it('stops at the lookup cap', () => {
    const many = Array.from({ length: MAX_LOOKUP_URLS + 5 }, (_, i) => `https://c.x/${i}.mp4`)
    expect(collectVideoUrls(many)).toHaveLength(MAX_LOOKUP_URLS)
  })
})

describe('withSmallVideos', () => {
  it('swaps each address that has a copy and keeps the rest as saved', () => {
    const other = 'https://cdn.example.com/other.mp4'
    const props = { a: { videoUrl: HERO }, b: [{ url: other }], c: 3 }
    const out = withSmallVideos(props, new Map([[HERO, SMALL]]))
    expect(out).toEqual({ a: { videoUrl: SMALL }, b: [{ url: other }], c: 3 })
    expect(out.b).toBe(props.b) // untouched paths are shared, not copied
    expect(props.a.videoUrl).toBe(HERO) // the input is never changed
  })

  it('returns the same value when no copy exists yet (the original plays)', () => {
    const props = { videoUrl: HERO }
    expect(withSmallVideos(props, new Map())).toBe(props)
  })
})
