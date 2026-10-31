import { describe, expect, it } from 'vitest'
import { tableMinWidth } from './table-state'

describe('tableMinWidth', () => {
  it('keeps the old 8rem-per-column floor', () => {
    expect(tableMinWidth([{}, {}, {}, {}, {}, {}])).toBe(48)
    expect(tableMinWidth([{}])).toBe(40)
  })

  it('widens the table so unsized columns keep their minimum beside percentage columns', () => {
    // 60% taken by two wide columns leaves 40% for six 8rem columns: 48 / 0.4 = 120rem.
    const columns = [
      { className: 'w-[30%]' },
      { className: 'w-[30%] whitespace-normal' },
      ...Array.from({ length: 6 }, () => ({})),
    ]
    expect(tableMinWidth(columns)).toBe(120)
  })

  it('counts fixed rem columns and per-column minimums', () => {
    expect(tableMinWidth([{ className: 'w-10' }, { minWidth: 30 }, { minWidth: 30 }])).toBe(63)
  })

  it('keeps a percentage column at the minimum it names', () => {
    expect(tableMinWidth([{ className: 'w-[10%]', minWidth: 9 }])).toBe(90)
  })
})
