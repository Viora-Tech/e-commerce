/** SOURCE OF TRUTH: marketing recipient tests — own-contact matching, the COD transactional step, manual recovery consent and phone lookup spellings, all pure (no database) */
import { describe, expect, it } from 'vitest'
import { type AutomationStep, isTransactionalStep } from './automation-steps'
import { mayNudgeKnownContact, phoneLookupVariants, recipientIsCustomers } from './recipient'

const cu = { email: 'Asha@X.in', phone: '+91 98765 43210' }
const flags = {
  acceptsMarketing: true,
  acceptsWhatsapp: false,
  acceptsSms: false,
  unsubscribedAt: null,
}

describe('recipientIsCustomers', () => {
  it("matches only the customer's own email and phone, however they are typed", () => {
    expect(recipientIsCustomers('email', ' asha@x.in ', cu)).toBe(true)
    expect(recipientIsCustomers('email', 'someone@x.in', cu)).toBe(false)
    expect(recipientIsCustomers('phone', '919876543210', cu)).toBe(true)
    expect(recipientIsCustomers('phone', '09876543210', cu)).toBe(true)
    expect(recipientIsCustomers('phone', '9111111111', cu)).toBe(false)
  })

  it('never matches without a customer, a stored address or an address to send to', () => {
    expect(recipientIsCustomers('email', 'asha@x.in', null)).toBe(false)
    expect(recipientIsCustomers('phone', '9876543210', { email: 'a@x.in', phone: null })).toBe(
      false,
    )
    expect(recipientIsCustomers('email', null, cu)).toBe(false)
    expect(recipientIsCustomers('phone', '12', { email: null, phone: '12' })).toBe(false)
  })
})

describe('isTransactionalStep', () => {
  const wa: AutomationStep = {
    id: 'w',
    type: 'whatsapp',
    template: { name: 't', language: 'en', variables: [] },
  }
  const wait: AutomationStep = { id: 'x', type: 'wait', minutes: 60 }

  it('is only the first WhatsApp step of a COD automation', () => {
    expect(isTransactionalStep('cod_order_placed', [wa, wait, wa], 0)).toBe(true)
    expect(isTransactionalStep('cod_order_placed', [wa, wait, wa], 2)).toBe(false)
    expect(isTransactionalStep('cod_order_placed', [wa, wa], 1)).toBe(false)
    expect(isTransactionalStep('cod_order_placed', [wait, wa], 1)).toBe(false)
    expect(isTransactionalStep('first_order', [wa], 0)).toBe(false)
  })
})

describe('mayNudgeKnownContact', () => {
  it('allows a guest nobody knows, and refuses when a known customer has not said yes', () => {
    expect(mayNudgeKnownContact([], 'whatsapp')).toBe(true)
    expect(mayNudgeKnownContact([flags], 'email')).toBe(true)
    expect(mayNudgeKnownContact([flags], 'whatsapp')).toBe(false)
    expect(mayNudgeKnownContact([flags, { ...flags, acceptsMarketing: false }], 'email')).toBe(
      false,
    )
    expect(mayNudgeKnownContact([{ ...flags, unsubscribedAt: new Date() }], 'email')).toBe(false)
  })
})

describe('phoneLookupVariants', () => {
  it('covers the digit spellings a blind index may have been built from', () => {
    expect(phoneLookupVariants('+91 98765 43210').sort()).toEqual(
      ['09876543210', '919876543210', '9876543210'].sort(),
    )
    expect(phoneLookupVariants('abc')).toEqual([])
  })
})
