import { describe, expect, it } from 'vitest'
import { fileName } from './file-meta'

describe('fileName', () => {
  it('drops the folders and the media id the upload put in front', () => {
    expect(fileName('stores/s1/media/01a0fb4b-9774-77ca-8a1e-0123456789ab-hero-glide.jpg')).toBe(
      'hero-glide.jpg',
    )
  })

  it('keeps a name with no id in front as it is', () => {
    expect(fileName('stores/s1/media/banner.jpg')).toBe('banner.jpg')
  })

  it('reads an address too, without its query or hash', () => {
    expect(fileName('https://cdn.example/a/void-black.png?w=200#x')).toBe('void-black.png')
  })
})
