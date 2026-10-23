/** SOURCE OF TRUTH: MIME-from-extension tests — WHAT: every known extension, URLs and storage keys with query/hash / WHY: imported files without a stored type are sorted by this map */
import { describe, expect, it } from 'vitest'
import { contentTypeFromName } from './content-type'

describe('contentTypeFromName', () => {
  it('maps every known extension, ignoring case', () => {
    expect(
      ['a.jpg', 'a.JPEG', 'a.png', 'a.webp', 'a.avif', 'a.gif', 'a.svg'].map(contentTypeFromName),
    ).toEqual([
      'image/jpeg',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/gif',
      'image/svg+xml',
    ])
    expect(['a.mp4', 'a.webm', 'a.MOV', 'a.pdf'].map(contentTypeFromName)).toEqual([
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'application/pdf',
    ])
  })

  it('reads URLs and storage keys, ignoring the query and hash', () => {
    expect(
      contentTypeFromName('https://cdn.shopify.com/s/files/1/files/DSC05770-1.png?v=1770291360'),
    ).toBe('image/png')
    expect(contentTypeFromName('https://x.test/clip.webm#t=3')).toBe('video/webm')
    expect(contentTypeFromName('stores/abc/media/01j.avif')).toBe('image/avif')
  })

  it('is null without an extension we know', () => {
    expect(contentTypeFromName('https://x.test/file')).toBeNull()
    expect(contentTypeFromName('https://x.test/v1.2/file?name=a.png')).toBeNull()
    expect(contentTypeFromName('.png')).toBeNull()
    expect(contentTypeFromName('notes.txt')).toBeNull()
    expect(contentTypeFromName('')).toBeNull()
  })
})
