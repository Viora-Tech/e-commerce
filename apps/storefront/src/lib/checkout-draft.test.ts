import { describe, expect, it } from 'vitest'
import { type CheckoutDraft, parseDraft, serialiseDraft } from './checkout-draft'

const draft: CheckoutDraft = {
  form: {
    name: 'Asha Verma',
    email: 'asha@example.com',
    phone: '+919876543210',
    line1: '14 Rajpath Colony',
    line2: '',
    city: 'Jaipur',
    stateCode: 'RJ',
    pincode: '302001',
    payment: 'razorpay',
    gstin: '',
    businessName: '',
    note: '',
  },
  savedId: 'new',
  business: false,
  rateId: 'rate_express',
}

describe('checkout draft', () => {
  it('round-trips for the same cart', () => {
    expect(parseDraft(serialiseDraft('cart_1', draft), 'cart_1')).toEqual(draft)
  })

  it('ignores another cart, junk and missing storage', () => {
    expect(parseDraft(serialiseDraft('cart_1', draft), 'cart_2')).toBeNull()
    expect(parseDraft('{not json', 'cart_1')).toBeNull()
    expect(parseDraft('null', 'cart_1')).toBeNull()
    expect(parseDraft(null, 'cart_1')).toBeNull()
  })

  it('rejects a draft with a missing or wrong-typed field', () => {
    const raw = JSON.parse(serialiseDraft('cart_1', draft))
    expect(parseDraft(JSON.stringify({ ...raw, form: { ...raw.form, city: 4 } }), 'cart_1')).toBe(
      null,
    )
    expect(parseDraft(JSON.stringify({ ...raw, business: 'yes' }), 'cart_1')).toBeNull()
    expect(
      parseDraft(
        JSON.stringify({ ...raw, form: { ...raw.form, note: 'x'.repeat(5000) } }),
        'cart_1',
      ),
    ).toBeNull()
  })

  it('drops keys it does not know', () => {
    const raw = JSON.parse(serialiseDraft('cart_1', draft))
    const parsed = parseDraft(
      JSON.stringify({ ...raw, form: { ...raw.form, isAdmin: true } }),
      'cart_1',
    )
    expect(parsed?.form).not.toHaveProperty('isAdmin')
  })
})
