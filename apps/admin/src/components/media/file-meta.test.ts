import { describe, expect, it } from 'vitest'
import { displayName, fileName, readableKeyName } from './file-meta'

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

describe('readableKeyName (#91)', () => {
  it('drops timestamps, hashes and "original" from an imported name', () => {
    expect(
      readableKeyName(
        'stores/s1/media/01a0fb4b-9774-77ca-8a1e-0123456789ab-1789453878-a1b2c3d4e5-red-mouse-pad-original.jpg',
      ),
    ).toBe('Red mouse pad')
  })

  it('is null when nothing readable is left', () => {
    expect(readableKeyName('stores/s1/media/1789453878-a1b2c3d4e5.jpg')).toBeNull()
  })
})

describe('displayName (#91)', () => {
  const key = 'stores/s1/media/01a0fb4b-9774-77ca-8a1e-0123456789ab-1789453878-image-original.jpg'

  it('prefers the saved name', () => {
    expect(displayName({ name: 'Hero banner', key, alt: 'Alt' })).toBe('Hero banner')
  })

  it('uses the alt text when the key leaves only a generic word', () => {
    expect(displayName({ name: null, key, alt: 'Black keyboard on a desk' })).toBe(
      'Black keyboard on a desk',
    )
    expect(displayName({ name: null, key, alt: null })).toBe('Image')
  })
})
