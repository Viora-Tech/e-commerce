import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import RichCopy from '../src/components/rich-copy'
import { richtextHtml } from '../src/richtext-html'
import { inlineRichtext, inlineText } from '../src/sections/inline-fields'

describe('richtext migration: legacy plain strings', () => {
  it('wraps a saved plain string in a paragraph, escaped', () => {
    expect(richtextHtml('Free shipping over Rs 999 & more')).toBe(
      '<p>Free shipping over Rs 999 &amp; more</p>',
    )
  })

  it('keeps blank lines as paragraphs and single newlines as breaks', () => {
    expect(richtextHtml('One\nline two\n\nSecond para')).toBe(
      '<p>One<br>line two</p><p>Second para</p>',
    )
  })

  it('treats angle brackets in plain copy as text, not markup', () => {
    expect(richtextHtml('Under 5 < 10 grams')).toBe('<p>Under 5 &lt; 10 grams</p>')
  })

  it('renders nothing for empty, blank or non-string values', () => {
    expect(richtextHtml('')).toBe('')
    expect(richtextHtml('   ')).toBe('')
    expect(richtextHtml(undefined)).toBe('')
    expect(richtextHtml({ root: {} })).toBe('')
  })
})

describe('richtext HTML from the Puck editor', () => {
  it('keeps the marks the B/I/U menu makes', () => {
    const html = '<p><strong>Bold</strong> <em>it</em> <u>under</u></p><ul><li>One</li></ul>'
    expect(richtextHtml(html)).toBe(html)
  })

  it('strips scripts, handlers, styles and javascript: links', () => {
    const out = richtextHtml(
      '<p onclick="x()" style="color:red">Hi<script>alert(1)</script><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)></p>',
    )
    expect(out).toBe('<p>Hi<a>x</a></p>')
  })

  it('keeps http(s) and root-relative images, nothing else', () => {
    expect(
      richtextHtml(
        '<p><img src="https://cdn.test/a.jpg" alt="A" width="40" title="t" style="x"><img src="/media/b.jpg" alt=""></p>',
      ),
    ).toBe(
      '<p><img src="https://cdn.test/a.jpg" alt="A" width="40" loading="lazy" decoding="async" /><img src="/media/b.jpg" alt="" loading="lazy" decoding="async" /></p>',
    )
    expect(
      richtextHtml(
        '<p>x<img src="data:image/png;base64,AAAA"><img src="//evil.test/a.jpg"><img src="b.jpg"><img></p>',
      ),
    ).toBe('<p>x</p>')
  })

  it('adds rel=noopener to links that open a new tab', () => {
    expect(richtextHtml('<p><a href="https://x.test" target="_blank">x</a></p>')).toBe(
      '<p><a href="https://x.test" target="_blank" rel="noopener noreferrer">x</a></p>',
    )
  })
})

describe('RichCopy', () => {
  it('draws a stored string as sanitised HTML', () => {
    const html = renderToStaticMarkup(createElement(RichCopy, { value: 'A & B', className: 'rte' }))
    expect(html).toBe('<div class="rte"><p>A &amp; B</p></div>')
  })

  it("draws the editor's React node as-is", () => {
    const node = createElement('span', null, 'inline editor')
    expect(renderToStaticMarkup(createElement(RichCopy, { value: node }))).toBe(
      '<div><span>inline editor</span></div>',
    )
  })

  it('draws nothing for an empty value', () => {
    expect(renderToStaticMarkup(createElement(RichCopy, { value: '' }))).toBe('')
  })
})

describe('inline field helpers', () => {
  it('turn on Puck inline editing', () => {
    expect(inlineText('Heading')).toMatchObject({ type: 'text', contentEditable: true })
    expect(inlineRichtext()).toMatchObject({ type: 'richtext', contentEditable: true })
  })
})
