import { describe, expect, it } from 'vitest'
import { drawsH1, fallbackHomeHeading } from './home-heading'

describe('fallbackHomeHeading', () => {
  it('adds nothing when the theme draws an h1 anywhere on the page', () => {
    expect(
      fallbackHomeHeading('Waimers', ['<div></div>', '<h1 class="visually-hidden">Waimers</h1>']),
    ).toBe('')
    expect(fallbackHomeHeading('Waimers', ['<H1>Shop</H1>'])).toBe('')
  })

  it('adds one hidden h1 with the escaped store name when none is drawn', () => {
    const h = fallbackHomeHeading(' Tom & "Co" ', ['<h2>Pick your gear</h2>', '<header></header>'])
    expect(h).toMatch(/^<h1 style="position:absolute;[^"]*">Tom &amp; &quot;Co&quot;<\/h1>$/)
    expect(h).not.toContain('px')
  })

  it('does not take h10-like tags or a header element for an h1', () => {
    expect(drawsH1(['<header class="h1"></header>', '<h1x>'])).toBe(false)
  })

  it('adds nothing for a store without a name', () => {
    expect(fallbackHomeHeading('  ', ['<p></p>'])).toBe('')
  })
})
