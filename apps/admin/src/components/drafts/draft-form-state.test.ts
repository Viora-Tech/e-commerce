import { parseRupees } from '@commerce/money'
import { describe, expect, it } from 'vitest'
import {
  type CustomItemFields,
  contactPhoneFrom,
  customItemErrors,
  customItemLine,
  draftStoreCreditMax,
  draftStoreCreditProblem,
  draftToPay,
  EMPTY_ADDRESS,
  emptyDraft,
  formToDraft,
  patchDraft,
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

describe('store credit on a draft (store credit step 3)', () => {
  const withCustomer = { ...emptyDraft(), customerId: 'c1', storeCreditPaise: 50_000 }

  it('saves the applied amount, and 0 when none is applied', () => {
    expect(formToDraft(withCustomer).storeCreditPaise).toBe(50_000)
    expect(formToDraft(emptyDraft()).storeCreditPaise).toBe(0)
  })

  it('offers up to the balance, never more than the total', () => {
    expect(draftStoreCreditMax(80_000, 200_000)).toBe(80_000)
    expect(draftStoreCreditMax(300_000, 200_000)).toBe(200_000)
    expect(draftStoreCreditMax(0, 200_000)).toBe(0)
    expect(draftStoreCreditMax(50_000, 0)).toBe(0)
  })

  it('leaves the rest to pay, never below zero', () => {
    expect(draftToPay(200_000, 50_000)).toBe(150_000)
    expect(draftToPay(200_000, 200_000)).toBe(0)
    expect(draftToPay(100_000, 0)).toBe(100_000)
  })

  it('says why the applied credit cannot stand', () => {
    expect(draftStoreCreditProblem(emptyDraft(), 100_000, 0)).toBeNull()
    expect(draftStoreCreditProblem(withCustomer, 100_000, 60_000)).toBeNull()
    expect(draftStoreCreditProblem(withCustomer, 100_000, null)).toBeNull()
    expect(draftStoreCreditProblem({ ...withCustomer, customerId: null }, 100_000, 60_000)).toBe(
      'no_customer',
    )
    expect(draftStoreCreditProblem(withCustomer, 40_000, 60_000)).toBe('over_total')
    expect(draftStoreCreditProblem(withCustomer, 100_000, 30_000)).toBe('over_balance')
  })

  it('clears the credit when another customer (or none) is picked, keeps it otherwise', () => {
    expect(patchDraft(withCustomer, { customerId: 'c2' }).storeCreditPaise).toBe(0)
    expect(patchDraft(withCustomer, { customerId: null }).storeCreditPaise).toBe(0)
    expect(patchDraft(withCustomer, { customerId: 'c1' }).storeCreditPaise).toBe(50_000)
    expect(patchDraft(withCustomer, { note: 'hi' }).storeCreditPaise).toBe(50_000)
    expect(patchDraft(withCustomer, { storeCreditPaise: 0 }).storeCreditPaise).toBe(0)
  })
})
