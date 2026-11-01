import { describe, expect, it } from 'vitest'
import { moveToPosition } from './form-state'

const list = (...ids: string[]) => ids.map((id) => ({ id }))
const ids = (items: { id: string }[]) => items.map((p) => p.id).join('')

describe('moveToPosition', () => {
  it('moves a product to the top, across any distance', () => {
    expect(ids(moveToPosition(list('a', 'b', 'c', 'd'), 'd', 1))).toBe('dabc')
  })

  it('moves a product down, keeping the others in order', () => {
    expect(ids(moveToPosition(list('a', 'b', 'c', 'd'), 'a', 3))).toBe('bcad')
  })

  it('clamps positions past either end', () => {
    expect(ids(moveToPosition(list('a', 'b', 'c'), 'b', 99))).toBe('acb')
    expect(ids(moveToPosition(list('a', 'b', 'c'), 'b', 0))).toBe('bac')
  })

  it('leaves the list alone for an unknown product', () => {
    const items = list('a', 'b')
    expect(moveToPosition(items, 'z', 1)).toBe(items)
  })
})
