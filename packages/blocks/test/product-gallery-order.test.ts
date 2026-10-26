import { describe, expect, it } from 'vitest'
import { galleryForVariant, slideForVariant, variantImageUrls } from '../src/product-gallery-order'
import type { MediaImage } from '../src/types'

const img = (name: string): MediaImage => ({ url: `https://cdn.test/${name}.jpg`, alt: null })
const [front, back, black1, black2, white1] = ['front', 'back', 'b1', 'b2', 'w1'].map(img) as [
  MediaImage,
  MediaImage,
  MediaImage,
  MediaImage,
  MediaImage,
]
const gallery = [front, back, black1, black2, white1]

describe('galleryForVariant', () => {
  it("puts the picked variant's images first in its own order, then the rest", () => {
    const black = { imageUrl: black2.url, imageUrls: [black2.url, black1.url] }
    expect(galleryForVariant(gallery, black)).toEqual([black2, black1, front, back, white1])
    expect(slideForVariant(galleryForVariant(gallery, black), black)).toBe(0)
  })

  it('leaves the gallery alone for a variant without images', () => {
    const plain = { imageUrl: null, imageUrls: [] }
    expect(galleryForVariant(gallery, plain)).toBe(gallery)
    expect(slideForVariant(gallery, plain)).toBe(0)
    expect(galleryForVariant(gallery, undefined)).toBe(gallery)
  })

  it('keeps the order for a single image and jumps to it', () => {
    const white = { imageUrl: white1.url, imageUrls: [white1.url] }
    expect(galleryForVariant(gallery, white)).toBe(gallery)
    expect(slideForVariant(gallery, white)).toBe(4)
  })

  it('reads an older payload that has only imageUrl', () => {
    expect(variantImageUrls({ imageUrl: back.url })).toEqual([back.url])
    expect(slideForVariant(gallery, { imageUrl: back.url })).toBe(1)
  })

  it('skips variant images the gallery does not hold', () => {
    const stray = {
      imageUrl: 'https://cdn.test/gone.jpg',
      imageUrls: ['https://cdn.test/gone.jpg', black1.url],
    }
    expect(galleryForVariant(gallery, stray)).toEqual([black1, front, back, black2, white1])
    const lost = {
      imageUrl: 'https://cdn.test/gone.jpg',
      imageUrls: ['https://cdn.test/gone.jpg', 'https://cdn.test/x.jpg'],
    }
    expect(galleryForVariant(gallery, lost)).toBe(gallery)
  })
})
