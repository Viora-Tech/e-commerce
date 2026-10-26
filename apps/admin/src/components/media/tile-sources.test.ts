import { describe, expect, it } from 'vitest'
import { tileImageUrls, videoPreviewUrl } from './tile-sources'

const url = 'https://cdn.test/stores/s/media/id-a.png'
const variants = {
  '320': { avif: 'https://cdn.test/a-w320.avif', webp: 'https://cdn.test/a-w320.webp' },
  '640': { avif: 'https://cdn.test/a-w640.avif', webp: 'https://cdn.test/a-w640.webp' },
  '1280': { avif: 'https://cdn.test/a-w1280.avif', webp: 'https://cdn.test/a-w1280.webp' },
}

describe('tileImageUrls', () => {
  it('tries the WebP copy at the tile width first, then the original', () => {
    expect(tileImageUrls({ url, variants })).toEqual(['https://cdn.test/a-w640.webp', url])
  })

  it('uses the smallest copy when the tile is narrower than all of them', () => {
    expect(tileImageUrls({ url, variants }, 100)).toEqual(['https://cdn.test/a-w320.webp', url])
  })

  it('falls back to the original alone while the file is still being optimised', () => {
    expect(tileImageUrls({ url, variants: null })).toEqual([url])
    expect(tileImageUrls({ url })).toEqual([url])
    expect(tileImageUrls({ url, variants: {} })).toEqual([url])
  })

  it('never lists the same URL twice', () => {
    expect(tileImageUrls({ url, variants: { '320': { avif: url, webp: url } } })).toEqual([url])
  })
})

describe('videoPreviewUrl', () => {
  it('asks for the frame at 0.1s', () => {
    expect(videoPreviewUrl('https://cdn.test/a.mp4')).toBe('https://cdn.test/a.mp4#t=0.1')
  })

  it('keeps a fragment that is already there', () => {
    expect(videoPreviewUrl('https://cdn.test/a.mp4#t=3')).toBe('https://cdn.test/a.mp4#t=3')
  })
})
