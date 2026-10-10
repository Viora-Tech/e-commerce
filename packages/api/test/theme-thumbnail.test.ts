import { describe, expect, it } from 'vitest'
import {
  decodeThumbnail,
  InvalidThumbnail,
  THUMBNAIL_DATA_URL_MAX,
  uploadThumbnail,
} from '../src/services/theme-thumbnail.service'

/** The smallest bytes that pass the header check: RIFF, a size, WEBP, then a chunk tag. */
const WEBP = Uint8Array.from([
  ...Buffer.from('RIFF'),
  26,
  0,
  0,
  0,
  ...Buffer.from('WEBPVP8 '),
  0,
  0,
  0,
  0,
])
/** The service's ceiling, 256 KB. */
const THUMBNAIL_MAX_BYTES = 256 * 1024
const dataUrl = (bytes: Uint8Array, type = 'image/webp') =>
  `data:${type};base64,${Buffer.from(bytes).toString('base64')}`

describe('theme thumbnails', () => {
  it('accepts a webp data URL and returns its bytes', () => {
    expect(decodeThumbnail(dataUrl(WEBP))).toEqual(WEBP)
  })

  it('refuses other types, a PNG labelled webp, and anything over the limit', () => {
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
    expect(() => decodeThumbnail(dataUrl(png, 'image/png'))).toThrow(InvalidThumbnail)
    expect(() => decodeThumbnail(dataUrl(png))).toThrow(InvalidThumbnail)
    const big = new Uint8Array(THUMBNAIL_MAX_BYTES + 1)
    big.set(WEBP)
    expect(() => decodeThumbnail(dataUrl(big))).toThrow('over 256 KB')
    // The input limit leaves room for the largest accepted picture.
    expect(dataUrl(new Uint8Array(THUMBNAIL_MAX_BYTES)).length).toBeLessThanOrEqual(
      THUMBNAIL_DATA_URL_MAX,
    )
  })

  it('writes one object per theme and versions its URL', async () => {
    const puts: string[] = []
    const storage = {
      put: async (input: { key: string }) => {
        puts.push(input.key)
      },
      publicUrl: (key: string) => `https://cdn.test/${key}`,
    }
    const url = await uploadThumbnail(storage, {
      storeId: 's1',
      themeId: 't1',
      bytes: WEBP,
      now: new Date(1_000),
    })
    expect(puts).toEqual(['stores/s1/themes/t1/thumbnail.webp'])
    expect(url).toBe('https://cdn.test/stores/s1/themes/t1/thumbnail.webp?v=1000')
  })
})
