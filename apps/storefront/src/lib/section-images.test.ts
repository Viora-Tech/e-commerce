import { describe, expect, it } from 'vitest'
import {
  collectImageUrls,
  heightForWidth,
  type ImageMedia,
  MAX_LOOKUP_URLS,
  withImageMedia,
} from './section-images'

const known: ImageMedia = {
  variants: { '640': { avif: 'https://cdn.test/b-640.avif', webp: 'https://cdn.test/b-640.webp' } },
  thumbhash: 'abc',
  width: 1600,
  height: 900,
}

const template = {
  content: [
    {
      type: 'ImageBanner',
      props: {
        id: 'ImageBanner-1',
        image: { url: 'https://cdn.test/b.jpg', alt: 'Banner', focal: { x: 50, y: 20 } },
        button: { label: 'Shop', href: '/collections/all' },
        settings: { style: { backgroundImage: { url: '', alt: '' } } },
      },
    },
    {
      type: 'Gallery',
      props: {
        id: 'Gallery-1',
        images: [
          { image: { url: 'https://elsewhere.test/x.png', alt: '' } },
          { image: { url: 'https://cdn.test/b.jpg', alt: 'Again' } },
        ],
      },
    },
  ],
}

describe('collectImageUrls', () => {
  it('finds every image setting once, skipping blanks and links', () => {
    expect(collectImageUrls(template)).toEqual([
      'https://cdn.test/b.jpg',
      'https://elsewhere.test/x.png',
    ])
  })

  it('skips images that already carry variants (product cards)', () => {
    expect(collectImageUrls({ image: { url: 'u', alt: null, variants: null } })).toEqual([])
  })

  it('caps the lookup', () => {
    const many = Array.from({ length: MAX_LOOKUP_URLS + 20 }, (_, i) => ({
      url: `https://cdn.test/${i}.jpg`,
      alt: '',
    }))
    expect(collectImageUrls(many)).toHaveLength(MAX_LOOKUP_URLS)
  })
})

describe('withImageMedia', () => {
  const media = new Map([['https://cdn.test/b.jpg', known]])
  const out = withImageMedia(template, media)

  it('adds variants and ThumbHash to images the library knows, keeping what was saved', () => {
    const banner = out.content[0]?.props.image
    expect(banner).toEqual({
      url: 'https://cdn.test/b.jpg',
      alt: 'Banner',
      focal: { x: 50, y: 20 },
      variants: known.variants,
      thumbhash: 'abc',
    })
    expect(out.content[1]?.props.images?.[1]?.image).toMatchObject({ variants: known.variants })
  })

  it('leaves unknown images and everything else untouched, and never mutates the input', () => {
    expect(out.content[1]?.props.images?.[0]).toBe(template.content[1]?.props.images?.[0])
    expect(out.content[0]?.props.button).toBe(template.content[0]?.props.button)
    expect(template.content[0]?.props.image).not.toHaveProperty('variants')
  })

  it('returns the same object when nothing matched', () => {
    expect(withImageMedia(template, new Map())).toBe(template)
  })
})

describe('heightForWidth', () => {
  it('keeps the aspect ratio', () => expect(heightForWidth(known, 160)).toBe(90))
  it('is undefined when the size is unknown', () => {
    expect(heightForWidth({ width: null, height: null }, 160)).toBeUndefined()
    expect(heightForWidth(undefined, 160)).toBeUndefined()
  })
})
