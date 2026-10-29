import { describe, expect, it } from 'vitest'
import { buildMatrix, diffVariants, priceRange, variantErrors, variantTitle } from './variants'

describe('priceRange', () => {
  it('skips variants without a price and is null when none has one (#913)', () => {
    expect(priceRange([500, null, 200])).toEqual({ min: 200, max: 500 })
    expect(priceRange([null, null])).toBeNull()
    expect(priceRange([])).toBeNull()
  })
})

const v = (optionValues: string[], id?: string) => ({ id, optionValues, pricePaise: 100 })

describe('variantTitle', () => {
  it('joins values with " / " and falls back to Default', () => {
    expect(variantTitle(['Red', 'Small'])).toBe('Red / Small')
    expect(variantTitle([' Red '])).toBe('Red')
    expect(variantTitle([])).toBe('Default')
  })
})

describe('buildMatrix', () => {
  it('builds the cartesian product in option order', () => {
    expect(
      buildMatrix([
        { name: 'Colour', values: [{ value: 'Red' }, { value: 'Blue' }] },
        { name: 'Size', values: [{ value: 'S' }, { value: 'M' }] },
      ]),
    ).toEqual([
      ['Red', 'S'],
      ['Red', 'M'],
      ['Blue', 'S'],
      ['Blue', 'M'],
    ])
  })
  it('is a single default row without options or with an empty option', () => {
    expect(buildMatrix([])).toEqual([[]])
    expect(buildMatrix([{ name: 'Size', values: [{ value: ' ' }] }])).toEqual([[]])
  })
})

describe('diffVariants', () => {
  const existing = [
    { id: 'a', title: 'Red / S', archivedAt: null },
    { id: 'b', title: 'Red / M', archivedAt: null },
    { id: 'c', title: 'Blue / S', archivedAt: new Date() },
  ]

  it('matches by id first, then by option combination', () => {
    const d = diffVariants(existing, [v(['Red', 'S'], 'a'), v(['Red', 'M'])])
    expect(d.update.map((u) => u.id)).toEqual(['a', 'b'])
    expect(d.create).toEqual([])
    expect(d.remove).toEqual([])
  })

  it('creates new combinations and removes missing live ones', () => {
    const d = diffVariants(existing, [v(['Red', 'S']), v(['Green', 'S'])])
    expect(d.create.map((c) => variantTitle(c.optionValues))).toEqual(['Green / S'])
    expect(d.remove.map((r) => r.id)).toEqual(['b'])
  })

  it('revives an archived variant whose combination returns', () => {
    const d = diffVariants(existing, [v(['Blue', 'S'])])
    expect(d.revive.map((r) => r.id)).toEqual(['c'])
    expect(d.create).toEqual([])
  })

  it('does not match one existing row twice', () => {
    const d = diffVariants(existing, [v(['Red', 'S'], 'a'), v(['Red', 'S'])])
    expect(d.update.map((u) => u.id)).toEqual(['a'])
    expect(d.create).toHaveLength(1)
  })

  it('treats an optionless product as a single Default variant', () => {
    const d = diffVariants([{ id: 'x', title: 'Default', archivedAt: null }], [v([])])
    expect(d.update.map((u) => u.id)).toEqual(['x'])
  })
})

describe('variantErrors', () => {
  it('accepts a consistent matrix', () => {
    expect(variantErrors([{ name: 'Size', values: [{ value: 'S' }] }], [v(['S'])])).toEqual([])
  })
  it('reports mismatches and duplicates', () => {
    const errors = variantErrors(
      [
        { name: 'Size', values: [{ value: 'S' }, { value: 's' }] },
        { name: 'size', values: [] },
      ],
      [v(['S']), v(['S', 'x']), v(['S', 'x'])],
    )
    expect(errors).toEqual(
      expect.arrayContaining([
        'Option names must be unique',
        'Option "Size" has duplicate values',
        'Option "size" needs at least one value',
        'Variant "S" does not match the options',
        'Duplicate variant "S / x"',
      ]),
    )
  })
  it('requires one variant', () => {
    expect(variantErrors([], [])).toContain('A product needs at least one variant')
  })
})
