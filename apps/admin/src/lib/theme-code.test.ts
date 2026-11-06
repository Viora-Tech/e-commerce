import { describe, expect, it } from 'vitest'
import { type CodeFileEntry, editorText, unpublishedNames } from './theme-code'

describe('editorText', () => {
  it('turns CRLF and lone CR into LF, as a textarea reports them', () => {
    expect(editorText('a\r\nb\rc\nd')).toBe('a\nb\nc\nd')
    expect(editorText('plain')).toBe('plain')
  })
})

describe('unpublishedNames', () => {
  const file = (path: string, draft: boolean) =>
    ({ path, size: 1, editable: true, readOnlyReason: null, draft }) as CodeFileEntry

  it('names only the files with saved, unpublished changes', () => {
    const files = [file('assets/base.css', true), file('layout/theme.liquid', false)]
    expect(unpublishedNames(files)).toEqual({ names: 'base.css', more: 0 })
  })

  it('counts the files past the fifth', () => {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((n) => file(`assets/${n}.css`, true))
    expect(unpublishedNames(files)).toEqual({
      names: 'a.css, b.css, c.css, d.css, e.css',
      more: 2,
    })
  })
})
