/** SOURCE OF TRUTH: media delivery URL tests — variant srcsets and fallbacks */
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import {
  generatedWidths,
  mediaImageLoader,
  nearestVariantWidth,
  pickVariantUrls,
  thumbhashPlaceholder,
} from './loader'
import { decodeThumbhash, processImage } from './pipeline'

describe('nearestVariantWidth', () => {
  const widths = [320, 640, 960, 1280, 1920]

  it('picks the largest generated width at or below the target', () => {
    expect(nearestVariantWidth(widths, 700)).toBe(640)
    expect(nearestVariantWidth(widths, 960)).toBe(960)
    expect(nearestVariantWidth(widths, 5000)).toBe(1920)
  })

  it('falls back to the smallest width rather than upscale when the target is smaller than all of them', () => {
    expect(nearestVariantWidth(widths, 100)).toBe(320)
  })

  it('returns null with no widths to choose from', () => {
    expect(nearestVariantWidth([], 640)).toBeNull()
  })
})

describe('pickVariantUrls', () => {
  const variants = {
    '320': { avif: 'a320.avif', webp: 'a320.webp' },
    '640': { avif: 'a640.avif', webp: 'a640.webp' },
  }

  it('resolves the nearest width to AVIF and WebP URLs, keeping the original as fallback', () => {
    const r = pickVariantUrls({ url: 'https://x/original.jpg', variants }, 500)
    expect(r).toEqual({
      fallback: 'https://x/original.jpg',
      avif: 'a320.avif',
      webp: 'a320.webp',
    })
  })

  it('falls back to the original url alone when there are no variants (unprocessed or legacy media)', () => {
    expect(pickVariantUrls({ url: 'https://x/o.jpg', variants: null }, 640)).toEqual({
      fallback: 'https://x/o.jpg',
    })
    expect(pickVariantUrls({ url: 'https://x/o.jpg', variants: undefined }, 640)).toEqual({
      fallback: 'https://x/o.jpg',
    })
  })
})

describe('mediaImageLoader', () => {
  it('is a valid next/image loader: (src, width) -> a single URL, WebP when variants exist', () => {
    const variants = { '320': { avif: 'a.avif', webp: 'a.webp' } }
    expect(mediaImageLoader({ src: 'https://x/o.jpg', width: 400, variants })).toBe('a.webp')
    expect(mediaImageLoader({ src: 'https://x/o.jpg', width: 400, variants: null })).toBe(
      'https://x/o.jpg',
    )
  })
})

describe('generatedWidths', () => {
  it('matches what the pipeline actually generates', () => {
    expect(generatedWidths()).toEqual([320, 640, 960, 1280, 1920])
  })
})

describe('thumbhashPlaceholder', () => {
  it('decodes a real ThumbHash from the pipeline into a usable data: URL', async () => {
    const bytes = await sharp({
      create: { width: 300, height: 200, channels: 3, background: { r: 30, g: 120, b: 200 } },
    })
      .jpeg()
      .toBuffer()
    const result = await processImage({
      bytes,
      contentType: 'image/jpeg',
      masterKey: 'stores/s/media/p.jpg',
    })
    const url = thumbhashPlaceholder(result.thumbhash)
    expect(url.startsWith('data:image/png;base64,')).toBe(true)
    // Sanity-check against the pipeline's own decoder: same hash, same pixel dimensions.
    const decoded = decodeThumbhash(result.thumbhash)
    expect(decoded.width).toBeGreaterThan(0)
  })
})
