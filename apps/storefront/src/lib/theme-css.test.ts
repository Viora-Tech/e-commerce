import { describe, expect, it } from 'vitest'
import {
  BUNDLE_FILE,
  bundleFiles,
  bundleThemeStylesheets,
  bundleVersion,
  joinCss,
  MAX_BUNDLE_FILES,
  minifyCss,
} from './theme-css'

const T = '01a1ad79-1023-7366-85dd-d8da62b44369'
const link = (file: string, v = 'abc123', extra = '') =>
  `<link href="/theme-assets/${T}/${file}?v=${v}" rel="stylesheet" type="text/css" media="all"${extra} />`

describe('bundleThemeStylesheets', () => {
  it('joins a run of theme stylesheet links into one link at the first, in order', () => {
    const html = `<head>${link('base.css')}\n${link('card.css', 'def')}</head><body><div>${link('price.css')}</div></body>`
    const out = bundleThemeStylesheets(html)
    const v = bundleVersion([
      { file: 'base.css', version: 'abc123' },
      { file: 'card.css', version: 'def' },
      { file: 'price.css', version: 'abc123' },
    ])
    expect(out).toBe(
      `<head><link rel="stylesheet" href="/theme-assets/${T}/${BUNDLE_FILE}?f=base.css,card.css,price.css&amp;v=${v}">\n</head><body><div></div></body>`,
    )
  })

  it('never joins across other CSS: a <style> or another stylesheet ends the run', () => {
    const html = `${link('a.css')}${link('b.css')}<style>.x{color:red}</style>${link('c.css')}<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">${link('d.css')}${link('e.css')}`
    const out = bundleThemeStylesheets(html)
    expect(out.match(/~bundle\.css\?f=([^&]+)/g)).toEqual([
      '~bundle.css?f=a.css,b.css',
      '~bundle.css?f=d.css,e.css',
    ])
    // A run of one stays as it was.
    expect(out).toContain(link('c.css'))
    expect(out.indexOf('<style>')).toBeLessThan(out.indexOf('c.css'))
  })

  it('leaves links with other media or attributes alone, and they end the run', () => {
    const html = `${link('a.css')}${link('print.css').replace('media="all"', 'media="print"')}${link('b.css')}${link('c.css', 'v1', ' onload="x()"')}${link('d.css')}`
    expect(bundleThemeStylesheets(html)).toBe(html)
  })

  it('keeps a file linked twice where it was, so the later copy still wins', () => {
    const out = bundleThemeStylesheets(`${link('a.css')}${link('b.css')}${link('a.css')}`)
    expect(out).toContain('?f=a.css,b.css,a.css&amp;')
  })

  it('does not touch links inside comments, scripts, templates or noscript', () => {
    const html = `<!-- ${link('a.css')}${link('b.css')} --><script>var s='${link('a.css')}${link('b.css')}'</script><template>${link('a.css')}${link('b.css')}</template><noscript>${link('a.css')}${link('b.css')}</noscript>`
    expect(bundleThemeStylesheets(html)).toBe(html)
  })

  it('only joins this asset route, one theme per bundle, and splits a very long run', () => {
    const other = '11111111-2222-3333-4444-555555555555'
    const html = `${link('a.css')}${link('b.css').replace(T, other)}<link rel="stylesheet" href="//cdn.shopify.com/x.css">`
    expect(bundleThemeStylesheets(html)).toBe(html)
    const many = Array.from({ length: MAX_BUNDLE_FILES + 2 }, (_, n) => link(`f${n}.css`)).join('')
    expect(bundleThemeStylesheets(many).match(/~bundle\.css/g)).toHaveLength(2)
  })

  it('changes the bundle URL when any file changes', () => {
    const a = bundleThemeStylesheets(`${link('a.css', 'v1')}${link('b.css', 'v1')}`)
    const b = bundleThemeStylesheets(`${link('a.css', 'v1')}${link('b.css', 'v2')}`)
    expect(a).not.toBe(b)
  })
})

describe('bundleFiles', () => {
  it('reads the file list and refuses paths and non-CSS', () => {
    expect(bundleFiles('base.css,card%20x.css')).toEqual(['base.css', 'card x.css'])
    expect(bundleFiles('../x.css')).toBeNull()
    expect(bundleFiles('a.js')).toBeNull()
    expect(bundleFiles('a%2Fb.css')).toBeNull()
    expect(bundleFiles(null)).toBeNull()
  })
})

describe('joinCss', () => {
  it('joins in order, drops @charset and moves a later @import to the top', () => {
    expect(joinCss(['@charset "utf-8";.a{}', '@import url(x.css);.b{}'])).toBe(
      '@import url(x.css);\n.a{}\n.b{}',
    )
  })
})

describe('minifyCss', () => {
  it('drops comments and shrinks whitespace without changing tokens', () => {
    const css = `/* tokens */\n:root {\n  --x: ;\n  --font: "A  B", sans-serif; /* note */\n}\n\n.a  >  .b:hover ,\n.c .d {\n  width: calc(100% - 2 * var(--g));\n  background: url(data:image/svg+xml;utf8,<svg/*x*/>) ;\n  color: red !important;\n}\n@media screen and (max-width: 749px) { .e { margin: 0 auto } }`
    expect(minifyCss(css)).toBe(
      ':root{--x: ;--font:"A  B",sans-serif;}.a > .b:hover,.c .d{width:calc(100% - 2 * var(--g));background:url(data:image/svg+xml;utf8,<svg/*x*/>);color:red !important;}@media screen and (max-width:749px){.e{margin:0 auto}}',
    )
  })

  it('keeps names apart that only a comment separated', () => {
    expect(minifyCss('a/**/b{}')).toBe('a/**/b{}')
    expect(minifyCss('a /* x */ b{}')).toBe('a b{}')
  })

  it('copies strings with escapes as they are', () => {
    expect(minifyCss(`.a::after { content: "\\"  /* not a comment */  " }`)).toBe(
      `.a::after{content:"\\"  /* not a comment */  "}`,
    )
  })
})
