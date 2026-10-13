import { describe, expect, it } from 'vitest'
import { displayPhone, type RecapInput, recapRows } from './checkout-recap'
import { stepsFor } from './checkout-steps'

const form: RecapInput['form'] = {
  name: 'Asha Verma',
  email: 'asha@example.com',
  phone: '+919876543210',
  line1: '14 Rajpath Colony',
  line2: '',
  city: 'Jaipur',
  pincode: '302001',
}
const rate = {
  id: 'r1',
  name: 'Express',
  pricePaise: 14_900,
  dateRange: 'Sat 11 Oct',
  codSurchargePaise: null,
}
const base: RecapInput = { step: 'address', steps: stepsFor(false), form, digitalOnly: false, rate }

describe('recapRows', () => {
  it('shows nothing on the first step', () => {
    expect(recapRows(base)).toEqual([])
  })

  it('recaps contact and address on shipping', () => {
    const rows = recapRows({ ...base, step: 'shipping' })
    expect(rows.map((r) => [r.label, r.value, r.step])).toEqual([
      ['Contact', 'asha@example.com · +91 98765 43210', 'address'],
      ['Ship to', 'Asha Verma, 14 Rajpath Colony, Jaipur 302001', 'address'],
    ])
  })

  it('adds the delivery pick on payment', () => {
    const rows = recapRows({ ...base, step: 'payment' })
    expect(rows.at(-1)).toMatchObject({
      label: 'Delivery',
      value: 'Express · ₹149 · Delivery by Sat 11 Oct',
      step: 'shipping',
    })
    expect(recapRows({ ...base, step: 'payment', rate: null }).at(-1)?.value).toBe('Free delivery')
  })

  it('bills instead of shipping for gift cards, with no delivery row', () => {
    const rows = recapRows({ ...base, step: 'payment', steps: stepsFor(true), digitalOnly: true })
    expect(rows.map((r) => r.label)).toEqual(['Contact', 'Billing'])
  })

  it('skips an empty email', () => {
    const rows = recapRows({ ...base, step: 'shipping', form: { ...form, email: '' } })
    expect(rows[0]?.value).toBe('+91 98765 43210')
  })
})

describe('displayPhone', () => {
  it('spaces an Indian mobile and leaves anything else', () => {
    expect(displayPhone('+919876543210')).toBe('+91 98765 43210')
    expect(displayPhone('+14155550100')).toBe('+14155550100')
  })
})
