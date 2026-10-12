import { describe, expect, it } from 'vitest'
import { pendingLiquidSlots, putLiquidSlot, takeLiquidSlot } from './liquid-slots'

describe('liquid slots', () => {
  it('hands the markup over once', () => {
    const id = putLiquidSlot('<p>hi</p>')
    expect(takeLiquidSlot(id)).toBe('<p>hi</p>')
    expect(takeLiquidSlot(id)).toBeUndefined()
  })

  it('gives every slot its own id', () => {
    const a = putLiquidSlot('a')
    const b = putLiquidSlot('a')
    expect(a).not.toBe(b)
    takeLiquidSlot(a)
    takeLiquidSlot(b)
  })

  it('drops slots nobody took within a minute', () => {
    const before = pendingLiquidSlots()
    const t0 = Date.now() + 1_000_000
    const stale = putLiquidSlot('stale', t0)
    expect(pendingLiquidSlots()).toBe(before + 1)
    const fresh = putLiquidSlot('fresh', t0 + 61_000)
    expect(takeLiquidSlot(stale)).toBeUndefined()
    expect(takeLiquidSlot(fresh)).toBe('fresh')
  })
})
