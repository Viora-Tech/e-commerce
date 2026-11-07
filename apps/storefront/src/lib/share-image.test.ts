import { describe, expect, it, vi } from 'vitest'

vi.mock('./store-cache', () => ({ storeRead: vi.fn() }))
vi.mock('./inbox-logo', () => ({ liveLiquidLogoUrl: vi.fn() }))

const { pickShareImage, shareImageUrl } = await import('./share-image')

const seo = { image: null, imageAlt: '', title: 'Store' }

describe('shareImageUrl', () => {
  it('picks the largest variant up to the share width', () => {
    const variants = { 640: { webp: 'a.webp' }, 1200: { webp: 'b.webp' }, 2000: { webp: 'c.webp' } }
    expect(shareImageUrl({ url: 'o.png', variants })).toBe('b.webp')
  })

  it('takes the smallest when every variant is wider', () => {
    expect(shareImageUrl({ url: 'o.png', variants: { 1600: { webp: 'c.webp' } } })).toBe('c.webp')
  })

  it('keeps the original without variants', () => {
    expect(shareImageUrl({ url: 'o.png', variants: null })).toBe('o.png')
  })
})

describe('pickShareImage', () => {
  it("prefers the merchant's share image", () => {
    const image = { url: 'share.jpg' }
    expect(pickShareImage({ ...seo, image, imageAlt: 'Alt' }, 'logo.png', 'Waimers')).toEqual([
      { url: 'share.jpg', alt: 'Alt' },
    ])
  })

  it('falls back to the logo', () => {
    expect(pickShareImage(seo, 'logo.png', 'Waimers')).toEqual([
      { url: 'logo.png', alt: 'Waimers' },
    ])
  })

  it('has nothing with neither', () => {
    expect(pickShareImage(seo, null, 'Waimers')).toBeUndefined()
  })
})
