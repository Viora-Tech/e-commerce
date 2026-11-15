import { describe, expect, it } from 'vitest'
import { storedRichtextHtml } from '../src/richtext-text'

/**
 * The browser side: this file never loads `richtext-html.ts`, so there is no sanitiser, as in the
 * storefront's browser bundle. Stored HTML the server did not prepare is shown as text, never as
 * markup.
 */
describe('storedRichtextHtml without the sanitiser', () => {
  it('shows stored HTML as escaped text', () => {
    const html = storedRichtextHtml(
      '<p onclick="x()">Hi<script>alert(1)</script><img src=x onerror=alert(1)></p>',
    )
    expect(html).not.toMatch(/<script|<img|onclick|onerror/)
    expect(html).toContain('Hi')
    expect(html).toMatch(/^<p>/)
  })

  it('keeps the legacy plain-string migration', () => {
    expect(storedRichtextHtml('A & B\n\nC < D')).toBe('<p>A &amp; B</p><p>C &lt; D</p>')
  })

  it('draws nothing for blank or non-string values', () => {
    expect(storedRichtextHtml('')).toBe('')
    expect(storedRichtextHtml({ root: {} })).toBe('')
  })
})
