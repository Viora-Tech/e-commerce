import { describe, expect, it } from 'vitest'
import { chosenItems, isVariantImage, moveId, toggleId } from './variant-images'

const item = (id: string, contentType: string | null = 'image/jpeg') => ({
  id,
  url: `https://cdn.test/${id}.jpg`,
  alt: null,
  contentType,
})

describe('variant images helpers', () => {
  it('toggles an id onto the end or off', () => {
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('moves one place earlier or later and stops at the ends', () => {
    expect(moveId(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
    expect(moveId(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveId(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(moveId(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })

  it('keeps chosen ids that are still in the gallery, in chosen order', () => {
    expect(chosenItems(['c', 'gone', 'a'], [item('a'), item('c')]).map((m) => m.id)).toEqual([
      'c',
      'a',
    ])
  })

  it('treats videos as product-only', () => {
    expect(isVariantImage(item('v', 'video/mp4'))).toBe(false)
    expect(isVariantImage(item('i'))).toBe(true)
    expect(isVariantImage(item('n', null))).toBe(true)
  })
})
