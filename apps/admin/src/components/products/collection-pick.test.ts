import { describe, expect, it } from 'vitest'
import { collectionIdsToSave, withCollection } from './collection-pick'

const A = '01a12b58-ced6-705a-a4a1-911d424f311e'
const B = '01a12b58-60bf-72b2-b345-1da8627fd0cf'
const options = [{ id: A }, { id: B }]

describe('withCollection (#804)', () => {
  it('adds an offered collection once', () => {
    expect(withCollection([], options, A)).toEqual([A])
    const ids = [A]
    expect(withCollection(ids, options, A)).toBe(ids)
  })

  it('ignores the null Base UI reports when the item list changes', () => {
    const ids = [A]
    expect(withCollection(ids, options, null)).toBe(ids)
    expect(withCollection(ids, options, undefined)).toBe(ids)
    expect(withCollection(ids, options, 'null')).toBe(ids)
    expect(withCollection(ids, options, '')).toBe(ids)
  })
})

describe('collectionIdsToSave', () => {
  it('drops ids that are not offered and repeats', () => {
    expect(collectionIdsToSave([A, 'null', B, A], options)).toEqual([A, B])
  })
})
