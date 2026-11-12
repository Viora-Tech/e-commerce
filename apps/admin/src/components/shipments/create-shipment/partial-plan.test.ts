import { describe, expect, it } from 'vitest'
import type { DraftParcel } from './flow-state'
import { availabilityNote, isPartial, keepOf, plannedParcel, startingPlan } from './partial-plan'

type Line = DraftParcel['lines'][number]

const line = (id: string, quantity: number, a: Partial<Line['availability']> = {}): Line => ({
  id,
  title: id,
  quantity,
  imageUrl: null,
  sku: null,
  unitPricePaise: 1000,
  weightGrams: 100,
  availability: { inStock: quantity, preorder: null, restockOn: null, ...a },
})

const parcel = (lines: Line[]): DraftParcel => ({
  id: 'fo1',
  position: 1,
  locationName: 'Gurugram',
  lines,
  valuePaise: 4000,
  weightGrams: 520,
  dimensionsCm: null,
  pickupLocationId: null,
  boxName: null,
})

describe('startingPlan', () => {
  it('ticks what is on the shelf and leaves a waiting pre-order behind', () => {
    const lines = [
      line('glasspad', 1),
      line('skates', 1, { inStock: 0, preorder: { arrivesOn: '2026-10-22' } }),
      line('rest', 2, { inStock: 1 }),
    ]
    const plan = startingPlan(lines)
    expect(plan.counts).toEqual({ glasspad: 1, skates: 0, rest: 1 })
    expect(plan).toMatchObject({ reason: 'not_ready', notify: true })
    expect(isPartial(lines, plan.counts)).toBe(true)
  })

  it('ticks everything when nothing, or everything, is ready', () => {
    const none = [line('a', 1, { inStock: 0 }), line('b', 1, { inStock: 0 })]
    expect(startingPlan(none).counts).toEqual({ a: 1, b: 1 })
    expect(isPartial(none, startingPlan(none).counts)).toBe(false)
    const all = [line('a', 2)]
    expect(startingPlan(all).counts).toEqual({ a: 2 })
  })
})

describe('plannedParcel', () => {
  it('ships the ticked units with their weight and share of the value', () => {
    const p = parcel([line('a', 1), line('b', 3)])
    const shown = plannedParcel(p, { a: 1, b: 1 })
    expect(shown.lines.map((l) => [l.id, l.quantity])).toEqual([
      ['a', 1],
      ['b', 1],
    ])
    expect(shown.valuePaise).toBe(2000)
    expect(shown.weightGrams).toBe(320)
    expect(keepOf(p.lines, { a: 1, b: 1 })).toEqual([
      { orderLineId: 'a', quantity: 1 },
      { orderLineId: 'b', quantity: 1 },
    ])
  })

  it('is the parcel itself when nothing is left behind', () => {
    const p = parcel([line('a', 1)])
    expect(plannedParcel(p, { a: 1 })).toBe(p)
  })
})

describe('availabilityNote', () => {
  it('chips a waiting pre-order, then a stock shortfall, else nothing', () => {
    expect(
      availabilityNote({ inStock: 0, preorder: { arrivesOn: '2026-10-22' }, restockOn: null }, 1),
    ).toEqual({ kind: 'preorder', date: '2026-10-22' })
    expect(availabilityNote({ inStock: 1, preorder: null, restockOn: null }, 2)).toEqual({
      kind: 'stock',
      n: 1,
    })
    expect(availabilityNote({ inStock: 2, preorder: null, restockOn: null }, 2)).toBeNull()
  })
})
