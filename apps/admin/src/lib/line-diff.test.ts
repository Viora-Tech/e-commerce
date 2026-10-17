import { describe, expect, it } from 'vitest'
import { changedLines, diffChangeCount, diffLines } from './line-diff'

describe('diffLines', () => {
  it('pairs a changed line with its replacement', () => {
    const rows = diffLines('a\nb\nc', 'a\nB\nc')
    expect(rows).toHaveLength(3)
    expect(rows[1]).toEqual({
      left: { no: 2, text: 'b', removed: true },
      right: { no: 2, text: 'B', added: true },
    })
    expect(diffChangeCount(rows)).toBe(1)
  })

  it('shows added and removed lines with nothing opposite', () => {
    const rows = diffLines('a\nc', 'a\nb\nc\nd')
    expect(rows.map((r) => [r.left?.text ?? null, r.right?.text ?? null])).toEqual([
      ['a', 'a'],
      [null, 'b'],
      ['c', 'c'],
      [null, 'd'],
    ])
  })

  it('marks the changed lines of the new text', () => {
    expect([...changedLines('x\ny\nz', 'x\nY\nz\nw')]).toEqual([2, 4])
    expect(changedLines('same', 'same').size).toBe(0)
  })
})
