/** SOURCE OF TRUTH: Shopify video file mapping tests — WHAT: which mp4 of a Shopify video is copied (tallest up to 1080p, never the 4K original), the phone-sized copy, the poster picture / WHY: hero carousels need a main file, a phone file and a poster; fixtures only, no network */
import { describe, expect, it } from 'vitest'
import { type GFile, mapFile } from '../src/api-files'

const mp4 = (name: string, height: number, fileSize: number) => ({
  url: `https://cdn.shopify.com/videos/${name}.mp4`,
  mimeType: 'video/mp4',
  fileSize,
  height,
  width: Math.round((height * 16) / 9),
})

const video = (sources: NonNullable<GFile['sources']>, extra: Partial<GFile> = {}): GFile => ({
  __typename: 'Video',
  id: 'gid://shopify/Video/1',
  alt: null,
  fileStatus: 'READY',
  filename: 'Website Lofree.mp4',
  preview: { image: { url: 'https://cdn.shopify.com/preview.jpg' } },
  originalSource: mp4('original-4k', 2160, 400_000_000),
  sources,
  ...extra,
})

describe('mapFile for a Shopify video', () => {
  it('copies the 1080p file, not the 4K original, plus a 720p for phones and the poster', () => {
    const f = mapFile(video([mp4('480', 480, 2e6), mp4('720', 720, 5e6), mp4('1080', 1080, 17e6)]))
    expect(f).toMatchObject({
      kind: 'video',
      url: 'https://cdn.shopify.com/videos/1080.mp4',
      mobileUrl: 'https://cdn.shopify.com/videos/720.mp4',
      posterUrl: 'https://cdn.shopify.com/preview.jpg',
      filename: 'Website Lofree.mp4',
      size: 17e6,
    })
  })

  it('has no phone copy when the only rendition is as small as the main one', () => {
    const f = mapFile(video([mp4('720', 720, 5e6)]))
    expect(f).toMatchObject({ url: 'https://cdn.shopify.com/videos/720.mp4', mobileUrl: null })
  })

  it('falls back to the original mp4 when Shopify lists no renditions', () => {
    const f = mapFile(video([], { originalSource: mp4('orig', 1080, 30e6) }))
    expect(f.url).toBe('https://cdn.shopify.com/videos/orig.mp4')
  })

  it('leaves a video with only over-limit copies uncopied, saying so', () => {
    const f = mapFile(video([mp4('huge', 1080, 2e9)], { originalSource: null }))
    expect(f.url).toBeNull()
  })
})
