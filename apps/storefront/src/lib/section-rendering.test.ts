import { describe, expect, it } from 'vitest'
import { MAX_SECTIONS, requestedSections, validSectionId } from './section-rendering'

describe('requestedSections', () => {
  it('lists each section once, in order, trimmed', () => {
    expect(requestedSections('header, cart-drawer,,header')).toEqual(['header', 'cart-drawer'])
  })

  it('caps the list as Shopify does', () => {
    const many = Array.from({ length: 8 }, (_, i) => `s${i}`).join(',')
    expect(requestedSections(many)).toHaveLength(MAX_SECTIONS)
  })

  it('is empty for an empty list', () => {
    expect(requestedSections('')).toEqual([])
    expect(requestedSections(' , ')).toEqual([])
  })
})

describe('validSectionId', () => {
  it('takes theme section names only', () => {
    expect(validSectionId('main-cart_items-2')).toBe(true)
    expect(validSectionId('../layout/theme')).toBe(false)
    expect(validSectionId('')).toBe(false)
    expect(validSectionId('a'.repeat(81))).toBe(false)
  })
})
