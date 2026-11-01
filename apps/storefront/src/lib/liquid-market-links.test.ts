import { describe, expect, it } from 'vitest'
import { withMarketPrefix } from './liquid-market-links'

describe('withMarketPrefix', () => {
  it('moves theme links under the market prefix', () => {
    const html =
      '<a href="/">Home</a><a href="/collections/all?filter.v.availability=1">x</a><form action="/search">'
    expect(withMarketPrefix(html, '/ae')).toBe(
      '<a href="/ae">Home</a><a href="/ae/collections/all?filter.v.availability=1">x</a><form action="/ae/search">',
    )
  })

  it('leaves shared, external, already prefixed and protocol-relative links alone', () => {
    const html = [
      '<a href="/ae/products/x">',
      '<form action="/theme-actions/localization">',
      '<link href="/cdn/shop/theme.css">',
      '<a href="https://waimers.in/x">',
      "<img src='/products/x.png'>",
      '<a href="//cdn.example.com/a">',
      '<a href="#top">',
    ].join('')
    expect(withMarketPrefix(html, '/ae')).toBe(html)
  })

  it('does nothing without a prefix', () => {
    expect(withMarketPrefix('<a href="/cart">', '')).toBe('<a href="/cart">')
  })
})
