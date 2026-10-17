import { describe, expect, it } from 'vitest'
import { highlightLines } from './code-highlight'

describe('highlightLines', () => {
  it('colours Liquid delimiters, keywords and strings, one row per line', () => {
    const lines = highlightLines("{% if a %}\n'x'{% endif %}", 'liquid')
    expect(lines).toHaveLength(2)
    expect(lines[0]?.map((t) => t.tone)).toEqual(['muted', 'plain', 'keyword', 'plain', 'muted'])
    expect(lines[1]?.[0]).toEqual({ text: "'x'", tone: 'string' })
  })

  it('tells JSON property names from string values', () => {
    const [line] = highlightLines('{"a": "b", "n": 2}', 'json')
    expect(line?.filter((t) => t.tone !== 'plain').map((t) => t.tone)).toEqual([
      'property',
      'string',
      'property',
      'number',
    ])
  })

  it('never matches a keyword inside a longer word', () => {
    const [line] = highlightLines('{{ format }}', 'liquid')
    expect(line?.some((t) => t.tone === 'keyword')).toBe(false)
  })
})
