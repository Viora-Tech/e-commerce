/** SOURCE OF TRUTH: variants table grouping (#54): group rows, search, select-all scope */
import { describe, expect, it } from 'vitest'
import { emptyVariant, type VariantRow } from './form-state'
import {
  defaultGroupBy,
  groupVariants,
  matchesVariant,
  matrixLines,
  shownIndexes,
} from './variant-groups'

function variant(optionValues: string[], patch: Partial<VariantRow> = {}): VariantRow {
  return { ...emptyVariant(optionValues), ...patch }
}

const sizes = ['Mini', 'Full', 'Pro']
const colours = ['Black', 'White', 'Red', 'Blue', 'Green']
const matrix = sizes.flatMap((s, i) =>
  colours.map((c, j) =>
    variant([s, c], { price: String(1000 + i * 100 + j * 10), quantity: '2', sku: `KB-${s}-${c}` }),
  ),
)

describe('defaultGroupBy', () => {
  it('groups by the first option on a big matrix with two options or more', () => {
    expect(defaultGroupBy(2, 15)).toBe(0)
    expect(defaultGroupBy(2, 6)).toBeNull()
    expect(defaultGroupBy(1, 15)).toBeNull()
  })
})

describe('matchesVariant', () => {
  it('matches every word against the title and SKU, ignoring case', () => {
    const v = matrix[0] as VariantRow
    expect(matchesVariant(v, '')).toBe(true)
    expect(matchesVariant(v, 'mini black')).toBe(true)
    expect(matchesVariant(v, 'kb-mini')).toBe(true)
    expect(matchesVariant(v, 'mini red')).toBe(false)
  })
})

describe('groupVariants', () => {
  it('turns 15 variants into 3 groups with price range and stock', () => {
    const groups = groupVariants(
      matrix,
      0,
      matrix.map((_, i) => i),
    )
    expect(groups.map((g) => g.value)).toEqual(sizes)
    expect(groups[0]).toMatchObject({
      indexes: [0, 1, 2, 3, 4],
      minPrice: 100000,
      maxPrice: 104000,
      stock: 10,
    })
  })

  it('leaves blank prices and untracked stock out of the summary', () => {
    const rows = [
      variant(['S', 'Red'], { price: '', quantity: '5', trackInventory: false }),
      variant(['S', 'Blue'], { price: '', quantity: '3' }),
    ]
    expect(groupVariants(rows, 0, [0, 1])[0]).toMatchObject({
      minPrice: null,
      maxPrice: null,
      stock: 3,
    })
  })
})

describe('matrixLines', () => {
  it('lists every variant flat without grouping', () => {
    const lines = matrixLines(matrix, { query: '', groupBy: null, open: [] })
    expect(lines).toHaveLength(15)
    expect(lines[0]).toEqual({ kind: 'variant', index: 0, nested: false })
  })

  it('shows closed groups as one row each, and an open group with its variants', () => {
    expect(matrixLines(matrix, { query: '', groupBy: 0, open: [] })).toHaveLength(3)
    const lines = matrixLines(matrix, { query: '', groupBy: 0, open: ['Full'] })
    expect(lines).toHaveLength(8)
    expect(lines[2]).toEqual({ kind: 'variant', index: 5, nested: true })
  })

  it('opens every group while searching and drops groups without matches', () => {
    const lines = matrixLines(matrix, { query: 'red', groupBy: 0, open: [] })
    expect(lines.filter((l) => l.kind === 'group')).toHaveLength(3)
    expect(lines.filter((l) => l.kind === 'variant')).toHaveLength(3)
    expect(matrixLines(matrix, { query: 'pro red', groupBy: 0, open: [] })).toHaveLength(2)
  })
})

describe('shownIndexes', () => {
  it('counts a closed group as all its variants and skips nothing on screen', () => {
    const lines = matrixLines(matrix, { query: 'black', groupBy: 1, open: [] })
    expect(shownIndexes(lines)).toEqual([0, 5, 10])
    expect(shownIndexes(matrixLines(matrix, { query: '', groupBy: 0, open: ['Mini'] }))).toEqual(
      matrix.map((_, i) => i),
    )
  })
})
