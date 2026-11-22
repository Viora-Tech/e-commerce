import { describe, expect, it } from 'vitest'
import { compactThemeHtml } from './liquid-compact'

describe('compactThemeHtml', () => {
  it('keeps only the line breaks of indentation between tags', () => {
    const html = '<ul>\n    <li>a</li>\r\n\r\n    <li>b</li>\n</ul>'
    expect(compactThemeHtml(html)).toBe('<ul>\n<li>a</li>\n\n<li>b</li>\n</ul>')
  })

  it('makes the whitespace between attributes one space and leaves values alone', () => {
    const html =
      '<img\n        src="/a.png"\n        alt="two  spaces\n  here"\n        loading="lazy"\n      >'
    expect(compactThemeHtml(html)).toBe(
      '<img src="/a.png" alt="two  spaces\n  here" loading="lazy">',
    )
    expect(compactThemeHtml('<a  href = \'x y\'  data-x="a>b" />')).toBe(
      '<a href=\'x y\' data-x="a>b" />',
    )
  })

  it('leaves spaces inside a line of text as they are', () => {
    expect(compactThemeHtml('<p>Price:   <b>Rs. 999</b>  each</p>')).toBe(
      '<p>Price:   <b>Rs. 999</b>  each</p>',
    )
    expect(compactThemeHtml('<span>\n   -5%\n </span>')).toBe('<span>\n-5%\n</span>')
  })

  it('copies raw-text elements, comments and SVG text byte for byte', () => {
    const raw = [
      '<script>\n  var a = `x\n    y`\n</script>',
      '<style>\n  .a {  color: red }\n</style>',
      '<pre>\n  keep\n    this\n</pre>',
      '<textarea>\n  typed\n</textarea>',
      '<!--\n    a comment\n-->',
      '<svg><text x="0">\n  label\n</text></svg>',
      '<SCRIPT>\n  if (a < b) {}\n</SCRIPT>',
    ]
    for (const html of raw) expect(compactThemeHtml(html)).toBe(html)
  })

  it('reads a stray less-than sign as text', () => {
    expect(compactThemeHtml('<p>1 < 2</p>')).toBe('<p>1 < 2</p>')
  })

  it('keeps a quote that is not a value from swallowing the rest of the tag', () => {
    expect(compactThemeHtml('<div it\'s   class="a">\n  x</div>')).toBe(
      '<div it\'s class="a">\nx</div>',
    )
  })
})
