import { describe, expect, it } from 'vitest'
import { richTextToHtml } from '../src/html'
import { emptyRichText, isRichTextEmpty, parseRichText, richTextToPlainText } from '../src/index'
import { fixture } from './fixture'

describe('richTextToHtml', () => {
  const html = richTextToHtml(fixture)

  it('renders headings, inline formats and alignment', () => {
    expect(html).toContain('<h2>Waimers Glasspad</h2>')
    expect(html).toContain('<strong>smooth</strong>')
    expect(html).toContain('<em>quiet</em>')
    expect(html).toContain('<p style="text-align:center"><br/></p>')
  })

  it('renders links with rel on new-tab links and drops unsafe protocols', () => {
    expect(html).toContain(
      '<a href="https://waimers.in/guide" target="_blank" rel="noopener noreferrer">',
    )
    expect(html).toContain('<a href="">bad</a>')
    expect(html).not.toContain('javascript:')
  })

  it('renders nested lists and checklists', () => {
    expect(html).toContain('<li class="richtext-nested">')
    expect(html).toContain('<ul class="richtext-checklist">')
    expect(html).toContain('data-checked="true"')
  })

  it('renders media only with safe sources', () => {
    expect(html).toContain('<img src="https://cdn.waimers.in/pad.jpg" alt="Pad" width="480"')
    expect(html).toContain('<figcaption>Pad</figcaption>')
    expect(html).not.toContain('data:image')
    expect(html).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(html).not.toContain('<script>')
  })

  it('renders collapsible, table and code', () => {
    expect(html).toContain('<details class="richtext-details"><summary>Specs</summary>')
    expect(html).toContain('<th>')
    expect(html).not.toContain('url(x)')
    expect(html).toContain(
      '<pre data-language="ts"><code><span class="richtext-token-keyword">const</span> x = 1</code></pre>',
    )
  })

  it('returns empty string for empty input', () => {
    expect(richTextToHtml(null)).toBe('')
    expect(richTextToHtml(emptyRichText())).toContain('<p><br/></p>')
  })
})

describe('richTextToPlainText', () => {
  it('joins blocks with newlines and skips markup', () => {
    const text = richTextToPlainText(fixture)
    expect(text.startsWith('Waimers Glasspad\nFast, smooth and quiet.')).toBe(true)
    expect(text).toContain('Glass surface\n4mm')
    expect(text).not.toContain('<')
  })
})

describe('parseRichText / isRichTextEmpty', () => {
  it('accepts objects, JSON strings and legacy plain text', () => {
    expect(parseRichText(fixture)).toBe(fixture)
    expect(parseRichText(JSON.stringify(fixture))?.root.children?.length).toBe(
      fixture.root.children?.length,
    )
    const legacy = parseRichText('line one\nline two')
    expect(legacy?.root.children?.length).toBe(2)
    expect(richTextToPlainText(legacy)).toBe('line one\nline two')
    expect(parseRichText('')).toBeNull()
    expect(parseRichText('{not json')).toBeNull()
  })

  it('detects empty documents', () => {
    expect(isRichTextEmpty(emptyRichText())).toBe(true)
    expect(isRichTextEmpty(null)).toBe(true)
    expect(isRichTextEmpty(fixture)).toBe(false)
  })
})
