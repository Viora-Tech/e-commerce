import { describe, expect, it } from 'vitest'
import { emptyForm, emptyVariant, type ProductFormState, type VariantRow } from '../form-state'
import { optionClash, variantPageWrite, withoutVariant } from './variant-page-state'

function row(id: string, optionValues: string[], patch: Partial<VariantRow> = {}): VariantRow {
  return { ...emptyVariant(optionValues), id, quantity: '5', ...patch }
}

function form(variants: VariantRow[]): ProductFormState {
  return {
    ...emptyForm(),
    title: 'Wooting 60HE',
    options: [
      { name: 'Size', values: ['60%', '80%'] },
      { name: 'Colour', values: ['Black', 'White'] },
    ],
    variants,
  }
}

const saved = form([
  row('a', ['60%', 'Black']),
  row('b', ['60%', 'White']),
  row('c', ['80%', 'Black'], { boxOwn: true, boxPresetId: 'box-80' }),
])

describe('variant page state', () => {
  it('sends stock only for the edited variant, and only when it changed', () => {
    const edited = form(
      saved.variants.map((v) => (v.id === 'b' ? { ...v, quantity: '9', price: '120' } : v)),
    )
    const write = variantPageWrite(edited, saved, 'b')
    expect(write.variants.map((v) => v.onHand)).toEqual([undefined, 9, undefined])
    expect(write.variants[1]?.pricePaise).toBe(12000)

    const priceOnly = form(saved.variants.map((v) => (v.id === 'b' ? { ...v, price: '99' } : v)))
    expect(variantPageWrite(priceOnly, saved, 'b').variants.map((v) => v.onHand)).toEqual([
      undefined,
      undefined,
      undefined,
    ])
  })

  it("keeps every variant in the write, with the others' own boxes and pre-order limits", () => {
    const write = variantPageWrite(saved, saved, 'a')
    expect(write.variants.map((v) => v.id)).toEqual(['a', 'b', 'c'])
    expect(write.variants[2]).toMatchObject({ boxOwn: true, boxPresetId: 'box-80' })
  })

  it('finds another variant with the same option values', () => {
    expect(optionClash(saved, 'a')).toBeNull()
    const clashing = form(
      saved.variants.map((v) => (v.id === 'a' ? { ...v, optionValues: ['60%', 'White'] } : v)),
    )
    expect(optionClash(clashing, 'a')).toBe('60% / White')
    expect(optionClash(form([row('only', [])]), 'only')).toBeNull()
  })

  it('deletes by saving the product without the variant', () => {
    const left = withoutVariant(saved, 'b')
    expect(left.variants.map((v) => v.id)).toEqual(['a', 'c'])
    expect(variantPageWrite(left, saved, 'b').variants.every((v) => v.onHand === undefined)).toBe(
      true,
    )
  })
})
