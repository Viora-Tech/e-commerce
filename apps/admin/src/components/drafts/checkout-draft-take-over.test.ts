import { describe, expect, it } from 'vitest'
import { takeOverRefusal } from './checkout-draft-take-over'

describe('takeOverRefusal', () => {
  it('reads the reason the API refused with', () => {
    expect(takeOverRefusal({ code: 'CONFLICT', data: { reason: 'paid' } })).toBe('paid')
    expect(takeOverRefusal({ code: 'CONFLICT', data: { reason: 'in_progress' } })).toBe(
      'in_progress',
    )
    expect(takeOverRefusal({ code: 'NOT_FOUND', data: { reason: 'not_found' } })).toBe('not_found')
  })

  it('is null for any other error', () => {
    expect(takeOverRefusal(new Error('boom'))).toBeNull()
    expect(takeOverRefusal(null)).toBeNull()
    expect(takeOverRefusal({ data: { reason: 'something_else' } })).toBeNull()
    expect(takeOverRefusal({ data: {} })).toBeNull()
  })
})
