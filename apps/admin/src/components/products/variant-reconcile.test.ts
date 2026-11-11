import { describe, expect, it } from 'vitest'
import { emptyVariant, type OptionRow, type VariantRow } from './form-state'
import { reconcileVariants } from './variant-reconcile'

const opt = (name: string, values: string[]): OptionRow => ({ name, values })
const row = (optionValues: string[], price = '100'): VariantRow => ({
  ...emptyVariant(optionValues, undefined),
  price,
})
const titles = (rows: VariantRow[]) => rows.map((r) => r.optionValues.join(' / '))

describe('reconcileVariants: deleted combinations', () => {
  const size = opt('Size', ['M', 'L'])
  const colour = opt('Colour', ['Red', 'Blue'])
  // L / Blue was deleted (bulk Delete): three rows of a 2 x 2 matrix.
  const rows = [row(['M', 'Red']), row(['M', 'Blue']), row(['L', 'Red'])]

  it('does not bring a deleted combination back when an option is edited', () => {
    const out = reconcileVariants([size, colour], [size, colour], rows)
    expect(titles(out.variants)).toEqual(['M / Red', 'M / Blue', 'L / Red'])
    expect(out.dropped).toEqual([])
  })

  it('still adds rows for a new value', () => {
    const bigger = opt('Size', ['M', 'L', 'XL'])
    const out = reconcileVariants([bigger, colour], [size, colour], rows)
    expect(titles(out.variants)).toEqual([
      'M / Red',
      'M / Blue',
      'L / Red',
      'XL / Red',
      'XL / Blue',
    ])
  })

  it('a new product still gets the whole matrix', () => {
    const out = reconcileVariants([size, colour], [], [])
    expect(out.variants).toHaveLength(4)
  })
})

describe('reconcileVariants: boxes (#1517)', () => {
  it("gives a new row the product's package, not the first row's own box", () => {
    const size = opt('Size', ['80%', '60%'])
    // The first row (the template for prices) ships in its own box.
    const rows = [
      { ...row(['80%']), boxPresetId: 'big', boxOwn: true },
      { ...row(['60%']), boxPresetId: 'small' },
    ]
    const out = reconcileVariants([opt('Size', ['80%', '60%', '100%'])], [size], rows)
    const added = out.variants.find((v) => v.optionValues[0] === '100%')
    expect(added?.boxPresetId).toBe('small')
    expect(added?.boxOwn).toBe(false)
  })
})
