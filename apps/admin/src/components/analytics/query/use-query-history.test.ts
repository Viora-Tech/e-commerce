import { describe, expect, it } from 'vitest'
import { record, redo, startHistory, TYPING_MERGE_MS, undo } from './use-query-history'

describe('query history', () => {
  it('merges a burst of typing into one step, and keeps edits apart', () => {
    let h = startHistory('FROM sales')
    h = record(h, 'FROM sales S', 'typing', 1000)
    h = record(h, 'FROM sales SH', 'typing', 1200)
    expect(h.past).toEqual(['FROM sales'])
    h = record(h, 'FROM sales SHOW', 'typing', 1200 + TYPING_MERGE_MS + 1)
    expect(h.past).toEqual(['FROM sales', 'FROM sales SH'])
    h = record(h, 'FROM products SHOW', 'edit', 3000)
    h = record(h, 'FROM products SHOW orders', 'typing', 3001)
    expect(h.past).toHaveLength(4)
  })

  it('undoes and redoes, and a new edit drops the redo trail', () => {
    let h = startHistory('a')
    h = record(h, 'b', 'edit', 1)
    h = record(h, 'c', 'edit', 2)
    h = undo(undo(h))
    expect(h.present).toBe('a')
    expect(undo(h)).toBe(h)
    h = redo(h)
    expect(h.present).toBe('b')
    h = record(h, 'x', 'edit', 3)
    expect(h.future).toEqual([])
    expect(redo(h)).toBe(h)
  })

  it('ignores a change to the same text', () => {
    const h = startHistory('a')
    expect(record(h, 'a', 'edit', 1)).toBe(h)
  })
})
