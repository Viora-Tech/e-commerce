import { describe, expect, it } from 'vitest'
import { parseSynonymLines, synonymLines } from './lines'

describe('synonym lines', () => {
  it('reads one group per line and drops lines with one word', () => {
    expect(parseSynonymLines('KB, keyboard , kb\nsolo\n\nmouse pad,  mousepad')).toEqual([
      ['kb', 'keyboard'],
      ['mouse pad', 'mousepad'],
    ])
  })

  it('writes groups back as lines', () => {
    expect(
      synonymLines([
        ['kb', 'keyboard'],
        ['tee', 't-shirt'],
      ]),
    ).toBe('kb, keyboard\ntee, t-shirt')
  })
})
