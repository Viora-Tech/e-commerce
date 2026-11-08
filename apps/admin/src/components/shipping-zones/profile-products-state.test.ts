import type { ProfileEntryVariant, ProfileProductEntry } from '@commerce/core'
import { describe, expect, it } from 'vitest'
import { addRows, rowsFrom, tickVariant, toPlacement } from './profile-products-state'

const v = (id: string, over: Partial<ProfileEntryVariant> = {}): ProfileEntryVariant => ({
  id,
  title: id,
  sku: null,
  inProfile: true,
  shipsUnder: null,
  placedElsewhere: false,
  requiresShipping: true,
  ...over,
})

const entry = (variants: ProfileEntryVariant[], whole = true): ProfileProductEntry => ({
  productId: 'deck',
  title: 'Deck',
  imageUrl: null,
  whole,
  variants,
})

describe('a shipping profile page saving its products and variants', () => {
  it('keeps a product whole while every variant that follows it is ticked', () => {
    const rows = rowsFrom([entry([v('s'), v('m'), v('l')])])
    expect(toPlacement(rows)).toEqual({ productIds: ['deck'], variantIds: [] })
  })

  it('turns a product into single variants once one is unticked', () => {
    const rows = tickVariant(rowsFrom([entry([v('s'), v('m'), v('l')])]), 'deck', 'l', false)
    expect(toPlacement(rows)).toEqual({ productIds: [], variantIds: ['s', 'm'] })
  })

  it('stays whole beside a variant placed in another profile, and can take that one too', () => {
    const elsewhere = v('l', {
      inProfile: false,
      placedElsewhere: true,
      shipsUnder: { id: 'b', name: 'B' },
    })
    const rows = rowsFrom([entry([v('s'), v('m'), elsewhere])])
    expect(toPlacement(rows)).toEqual({ productIds: ['deck'], variantIds: [] })
    expect(toPlacement(tickVariant(rows, 'deck', 'l', true))).toEqual({
      productIds: ['deck'],
      variantIds: ['l'],
    })
  })

  it('never places a variant that needs no shipping, and drops a product with nothing ticked', () => {
    const rows = rowsFrom([entry([v('s'), v('download', { requiresShipping: false })])])
    expect(toPlacement(rows)).toEqual({ productIds: ['deck'], variantIds: [] })
    expect(toPlacement(tickVariant(rows, 'deck', 's', false))).toEqual({
      productIds: [],
      variantIds: [],
    })
  })

  it('adds picked products with the variants picked, or whole when none were named', () => {
    const fresh = entry([v('s', { inProfile: false }), v('m', { inProfile: false })], false)
    const some = addRows([], [fresh], new Map([['deck', ['m']]]))
    expect(toPlacement(some)).toEqual({ productIds: [], variantIds: ['m'] })
    expect(toPlacement(addRows(some, [fresh], new Map()))).toEqual({
      productIds: ['deck'],
      variantIds: [],
    })
  })
})
