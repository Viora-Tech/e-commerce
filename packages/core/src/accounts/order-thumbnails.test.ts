/** SOURCE OF TRUTH: order card thumbnails — WHAT: one picture per product, line order, at most three / WHY: Figma 705:114276 order cards */
import { describe, expect, it } from 'vitest'
import { orderThumbnails } from './order-thumbnails'

const img = (productId: string, url: string) => ({ productId, url, alt: null })

describe('orderThumbnails', () => {
  it('takes each product’s first picture in line order', () => {
    const images = [img('b', 'b1'), img('a', 'a1'), img('a', 'a2'), img('b', 'b2')]
    expect(orderThumbnails(['a', 'b'], images).map((t) => t.url)).toEqual(['a1', 'b1'])
  })

  it('counts a product once and skips one without pictures', () => {
    const images = [img('a', 'a1'), img('c', 'c1')]
    expect(orderThumbnails(['a', 'a', 'b', 'c'], images).map((t) => t.url)).toEqual(['a1', 'c1'])
  })

  it('stops at the limit', () => {
    const images = ['a', 'b', 'c', 'd'].map((p) => img(p, `${p}1`))
    expect(orderThumbnails(['a', 'b', 'c', 'd'], images)).toHaveLength(3)
  })
})
