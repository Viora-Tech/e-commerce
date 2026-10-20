import { describe, expect, it } from 'vitest'
import { editorText } from './theme-code'

describe('editorText', () => {
  it('turns CRLF and lone CR into LF, as a textarea reports them', () => {
    expect(editorText('a\r\nb\rc\nd')).toBe('a\nb\nc\nd')
    expect(editorText('plain')).toBe('plain')
  })
})
