import { describe, expect, it } from 'vitest'
import { ImageDrop } from './drops'
import { imageTag, imageUrl } from './filter-values'

const copy = (width: number) => ({ avif: `w${width}.avif`, webp: `w${width}.webp` })
const sized = (width: number | null = 2400) =>
  new ImageDrop({
    url: 'master.png',
    width,
    height: width,
    variants: { '640': copy(640), '320': copy(320), '1280': copy(1280) },
  })

describe('image_url on an imported theme', () => {
  it('picks the smallest copy that is wide enough', () => {
    expect(String(imageUrl(sized(), { width: 165 }))).toBe('w320.webp')
    expect(String(imageUrl(sized(), { width: 320 }))).toBe('w320.webp')
    expect(String(imageUrl(sized(), { width: 533 }))).toBe('w640.webp')
  })

  it('keeps the original past the largest copy, so a big image never goes soft', () => {
    expect(String(imageUrl(sized(), { width: 1500 }))).toBe('master.png')
  })

  it('uses the largest copy when the original is no bigger', () => {
    expect(String(imageUrl(sized(1280), { width: 1500 }))).toBe('w1280.webp')
  })

  it('falls back to the original without copies or without a width', () => {
    expect(String(imageUrl(new ImageDrop({ url: 'old.jpg' }), { width: 320 }))).toBe('old.jpg')
    expect(String(imageUrl(sized(), {}))).toBe('master.png')
    expect(String(imageUrl('plain.jpg', { width: 320 }))).toBe('plain.jpg')
  })

  it('keeps the variant map out of a theme that prints the image as JSON', () => {
    expect(JSON.stringify(sized())).not.toContain('w320')
  })
})

describe('image_tag on an imported theme', () => {
  it('writes a srcset when the theme says how wide the image shows', () => {
    const html = imageTag(imageUrl(sized(), { width: 640 }), { sizes: '50vw' })
    expect(html).toContain('src="w640.webp"')
    expect(html).toContain('srcset="w320.webp 320w, w640.webp 640w, w1280.webp 1280w"')
    expect(html).toContain('sizes="50vw"')
  })

  it('leaves srcset out without sizes, or when the theme turns it off', () => {
    expect(imageTag(imageUrl(sized(), { width: 320 }), {})).not.toContain('srcset')
    expect(imageTag(sized(), { sizes: '50vw', srcset: false })).not.toContain('srcset')
  })
})
