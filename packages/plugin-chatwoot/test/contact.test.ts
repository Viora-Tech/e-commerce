import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { ChatwootContact } from '../src/client'
import {
  type CustomerFacts,
  contactAttributes,
  contactInput,
  contactNeedsUpdate,
  identifierHash,
  pickContact,
} from '../src/contact'

const facts: CustomerFacts = {
  id: '01a134be-8765-7038-8c41-08a2179577bb',
  name: 'Asha Mehta',
  email: 'asha@example.com',
  phone: '+91 98765-43210',
  createdAt: new Date('2025-03-04T10:00:00Z'),
  orderCount: 3,
  spentPaise: 459_950,
  lastOrderNumber: 1042,
  lastOrderAt: new Date('2026-10-01T08:00:00Z'),
}

const contact = (over: Partial<ChatwootContact> = {}): ChatwootContact => ({
  id: 7,
  name: 'Asha Mehta',
  email: 'asha@example.com',
  phone: '+919876543210',
  identifier: facts.id,
  customAttributes: contactAttributes(facts),
  ...over,
})

describe('contact', () => {
  it('attributes: customer since, orders, total spent in rupees, last order', () => {
    expect(contactAttributes(facts)).toEqual({
      customer_since: '2025-03-04',
      orders_count: 3,
      total_spent: 4599.5,
      last_order: '#1042',
      last_order_at: '2026-10-01',
    })
    expect(
      contactAttributes({ ...facts, orderCount: 0, lastOrderNumber: null, lastOrderAt: null }),
    ).toEqual({ customer_since: '2025-03-04', orders_count: 0, total_spent: 4599.5 })
  })

  it('input: our id as the identifier, E.164 phone only', () => {
    expect(contactInput(facts)).toMatchObject({
      identifier: facts.id,
      name: 'Asha Mehta',
      email: 'asha@example.com',
      phone_number: '+919876543210',
    })
    const local = contactInput({ ...facts, phone: '98765 43210', name: null, email: null })
    expect(local).not.toHaveProperty('phone_number')
    expect(local).not.toHaveProperty('name')
    expect(local).not.toHaveProperty('email')
  })

  it('identifier hash is HMAC-SHA256 hex, as Chatwoot checks it', () => {
    const expected = createHmac('sha256', 'secret').update(facts.id).digest('hex')
    expect(identifierHash('secret', facts.id)).toBe(expected)
    expect(identifierHash('secret', facts.id)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('an up-to-date contact needs no write', () => {
    expect(contactNeedsUpdate(contact(), contactInput(facts))).toBe(false)
    expect(contactNeedsUpdate(contact({ email: 'ASHA@example.com' }), contactInput(facts))).toBe(
      false,
    )
  })

  it('a changed name, attribute or missing identifier needs a write', () => {
    expect(contactNeedsUpdate(contact({ name: 'Asha' }), contactInput(facts))).toBe(true)
    expect(contactNeedsUpdate(contact({ identifier: null }), contactInput(facts))).toBe(true)
    expect(contactNeedsUpdate(contact(), contactInput({ ...facts, orderCount: 4 }))).toBe(true)
  })

  it('picks our identifier first, then a free contact by email, then by phone', () => {
    const who = { id: facts.id, email: 'asha@example.com', phone: '+919876543210' }
    const mine = contact()
    const guest = contact({ id: 8, identifier: null })
    const other = contact({ id: 9, identifier: 'someone-else' })
    expect(pickContact([guest, mine], who)?.id).toBe(7)
    expect(pickContact([other, guest], who)?.id).toBe(8)
    expect(pickContact([other], who)).toBeNull()
    const byPhone = contact({ id: 10, identifier: null, email: null })
    expect(pickContact([byPhone], { ...who, email: null })?.id).toBe(10)
  })
})
