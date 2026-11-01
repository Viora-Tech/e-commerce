import { parseRupees } from '@commerce/money'
import { describe, expect, it } from 'vitest'
import {
  type CustomItemFields,
  customItemErrors,
  customItemLine,
  emptyDraft,
  formToDraft,
} from './draft-form-state'

const fields = (over: Partial<CustomItemFields> = {}): CustomItemFields => ({
  title: 'Gift wrapping',
  price: '49',
  quantity: '1',
  taxable: true,
  hsCode: '',
  ...over,
})

describe('customItemErrors', () => {
  it('accepts a named item with a price and quantity', () => {
    expect(customItemErrors(fields(), parseRupees)).toEqual([])
    expect(customItemErrors(fields({ price: '0', hsCode: '48239090' }), parseRupees)).toEqual([])
  })

  it('names each field that is wrong', () => {
    expect(
      customItemErrors(
        fields({ title: '  ', price: 'abc', quantity: '0', hsCode: '123' }),
        parseRupees,
      ),
    ).toEqual(['title', 'price', 'quantity', 'hsCode'])
    expect(customItemErrors(fields({ quantity: '1.5' }), parseRupees)).toEqual(['quantity'])
    expect(customItemErrors(fields({ quantity: '1000' }), parseRupees)).toEqual(['quantity'])
  })
})

describe('custom item lines', () => {
  it('saves as a custom line with its own price, never a variant', () => {
    const line = customItemLine(fields({ taxable: false, hsCode: ' 9985 ' }), 4900, 'custom:1')
    const draft = formToDraft({ ...emptyDraft(), lines: [line] })
    expect(draft.lines).toEqual([
      {
        custom: { title: 'Gift wrapping', taxable: false, hsCode: '9985' },
        quantity: 1,
        unitPricePaise: 4900,
      },
    ])
  })
})
