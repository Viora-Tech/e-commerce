import { parseRupees } from '@commerce/money'
import { describe, expect, it } from 'vitest'
import {
  type CustomItemFields,
  contactPhoneFrom,
  customItemErrors,
  customItemLine,
  EMPTY_ADDRESS,
  emptyDraft,
  formToDraft,
  stateFor,
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

describe('picking a customer fills state and phone (#1028)', () => {
  it('a new address starts with no state instead of guessing Haryana', () => {
    expect(EMPTY_ADDRESS.stateCode).toBe('')
  })

  it('keeps a saved state that agrees with the PIN code', () => {
    expect(stateFor('421204', 'MH')).toBe('MH')
    expect(stateFor('403001', 'GA')).toBe('GA')
  })

  it('takes the PIN code state when the saved one cannot be right', () => {
    expect(stateFor('110001', 'HR')).toBe('DL')
    expect(stateFor('560001', '')).toBe('KA')
  })

  it("fixes the issue's case: Haryana saved on a Thane PIN code shows Maharashtra", () => {
    expect(stateFor('421204', 'HR')).toBe('MH')
  })

  it("uses the customer's phone, else the suggested mobile, else the address's", () => {
    const suggestion = {
      phoneSuggestion: { phone: '9876543210', source: 'order' as const, takenBy: null },
    }
    const taken = {
      phoneSuggestion: { phone: '9876543210', source: 'order' as const, takenBy: 'Asha' },
    }
    const address = { ...EMPTY_ADDRESS, phone: '9123456780' }
    expect(contactPhoneFrom('9000000000', suggestion, address)).toBe('9000000000')
    expect(contactPhoneFrom(null, suggestion, address)).toBe('9876543210')
    expect(contactPhoneFrom('', { phoneSuggestion: null }, address)).toBe('9123456780')
    expect(contactPhoneFrom(null, taken, address)).toBe('9123456780')
    expect(contactPhoneFrom(null, null, undefined)).toBe('')
  })
})
