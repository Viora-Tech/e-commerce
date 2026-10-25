import { describe, expect, it } from 'vitest'
import { contactMatches, orderNumberFrom } from './track-order'

describe('orderNumberFrom', () => {
  it('reads the number however it is typed', () => {
    expect(orderNumberFrom('#1042')).toBe(1042)
    expect(orderNumberFrom(' 1042 ')).toBe(1042)
    expect(orderNumberFrom('W1042')).toBe(1042)
  })

  it('has no number without digits, for zero, or for an absurd length', () => {
    expect(orderNumberFrom('order')).toBeNull()
    expect(orderNumberFrom('0')).toBeNull()
    expect(orderNumberFrom('1234567890123')).toBeNull()
  })
})

describe('contactMatches', () => {
  const order = { email: 'Riya@Example.com', phone: '+91 98765 43210' }

  it('matches the email whatever its case', () => {
    expect(contactMatches(' riya@example.COM ', order)).toBe(true)
    expect(contactMatches('someone@example.com', order)).toBe(false)
  })

  it('matches the mobile on its last ten digits', () => {
    expect(contactMatches('9876543210', order)).toBe(true)
    expect(contactMatches('098765 43210', order)).toBe(true)
    expect(contactMatches('98765', order)).toBe(false)
  })

  it('never matches an empty field or a contact the order does not have', () => {
    expect(contactMatches('', order)).toBe(false)
    expect(contactMatches('9876543210', { email: null, phone: null })).toBe(false)
    expect(contactMatches('a@b.co', { email: null, phone: null })).toBe(false)
  })
})
