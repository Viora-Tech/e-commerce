/** SOURCE OF TRUTH: review photo copies — WHAT: the storefront draws a review photo from its sized WebP copy, never the phone's original; HOW: pure tests, no database. */
import { describe, expect, it } from 'vitest'
import { photoCopy } from './reviews'

const photo = {
  url: 'https://cdn.example/r-original.jpg',
  variants: {
    '1280': { avif: 'r-1280.avif', webp: 'r-1280.webp' },
    '320': { avif: 'r-320.avif', webp: 'r-320.webp' },
    '640': { avif: 'r-640.avif', webp: 'r-640.webp' },
  },
}

describe('photoCopy', () => {
  it('picks the smallest copy at least that wide', () => {
    expect(photoCopy(photo, 300)).toBe('r-320.webp')
    expect(photoCopy(photo, 640)).toBe('r-640.webp')
    expect(photoCopy(photo, 900)).toBe('r-1280.webp')
  })

  it('takes the largest copy past every copy, the original only without copies', () => {
    expect(photoCopy(photo, 4000)).toBe('r-1280.webp')
    expect(photoCopy({ url: photo.url, variants: null }, 640)).toBe(photo.url)
  })
})
