import { describe, expect, it } from 'vitest'
import { paymentDueAt, paymentOverdue } from './payment-terms'

const placed = new Date('2026-11-03T10:00:00Z')

describe('paymentDueAt', () => {
  it('is due at once on receipt', () => {
    expect(paymentDueAt('receipt', placed)).toEqual(placed)
  })

  it('adds the net days', () => {
    expect(paymentDueAt('net_15', placed)).toEqual(new Date('2026-11-18T10:00:00Z'))
    expect(paymentDueAt('net_90', placed)).toEqual(new Date('2027-02-01T10:00:00Z'))
  })

  it('uses the chosen date for fixed terms, none without one', () => {
    const on = new Date('2026-12-01T00:00:00Z')
    expect(paymentDueAt('fixed', placed, on)).toEqual(on)
    expect(paymentDueAt('fixed', placed)).toBeNull()
  })

  it('has no date until fulfilment', () => {
    expect(paymentDueAt('fulfillment', placed)).toBeNull()
  })
})

describe('paymentOverdue', () => {
  it('is overdue only after the due date', () => {
    const due = new Date('2026-11-18T10:00:00Z')
    expect(paymentOverdue(due, new Date('2026-11-18T09:00:00Z'))).toBe(false)
    expect(paymentOverdue(due, new Date('2026-11-18T11:00:00Z'))).toBe(true)
    expect(paymentOverdue(null, new Date('2030-01-01T00:00:00Z'))).toBe(false)
  })
})
