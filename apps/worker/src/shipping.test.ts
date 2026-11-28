import { describe, expect, it } from 'vitest'
import { inBatches } from './shipping'

describe('inBatches', () => {
  it('splits waybills into calls of at most the courier batch size, in order', () => {
    const waybills = Array.from({ length: 120 }, (_, i) => `W${i}`)
    const batches = inBatches(waybills, 50)
    expect(batches.map((b) => b.length)).toEqual([50, 50, 20])
    expect(batches.flat()).toEqual(waybills)
  })

  it('never makes an empty or endless batch', () => {
    expect(inBatches([], 50)).toEqual([])
    expect(inBatches(['a', 'b'], 0)).toEqual([['a'], ['b']])
  })
})
