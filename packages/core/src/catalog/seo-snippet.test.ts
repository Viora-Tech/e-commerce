/** SOURCE OF TRUTH: seoSnippet tests — WHAT: spec rows skipped, first real sentences kept / WHY: the snippet Google shows */
import { describe, expect, it } from 'vitest'
import { seoSnippet } from './seo-snippet'

describe('seoSnippet', () => {
  it('skips a spec table and uses the real sentences', () => {
    const plain = [
      'Specification',
      'Material: Stainless steel',
      'Weight: 58 g',
      'A featherweight wireless mouse built for fast flicks and long sessions.',
    ].join('\n')
    expect(seoSnippet(plain)).toBe(
      'A featherweight wireless mouse built for fast flicks and long sessions.',
    )
  })

  it('falls back to everything when nothing reads as prose', () => {
    expect(seoSnippet('Material: Steel\nWeight: 58 g')).toBe('Material: Steel Weight: 58 g')
  })
})
