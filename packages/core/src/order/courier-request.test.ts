import { describe, expect, it } from 'vitest'
import { COURIER_REQUEST_MAX, cleanCourierRequest, courierRequestNote } from './courier-request'

describe('cleanCourierRequest', () => {
  it('keeps one trimmed line, and nothing when blank', () => {
    expect(cleanCourierRequest('  DTDC \n please ')).toBe('DTDC please')
    expect(cleanCourierRequest('   ')).toBeNull()
    expect(cleanCourierRequest(null)).toBeNull()
    expect(cleanCourierRequest(undefined)).toBeNull()
  })

  it('cuts a long request to the limit', () => {
    expect(cleanCourierRequest('x'.repeat(200))?.length).toBe(COURIER_REQUEST_MAX)
  })

  it('tells the store to call with the price', () => {
    expect(courierRequestNote('India Post')).toBe(
      'Shopper asked for another courier: India Post. Call them with the price before you ship.',
    )
  })
})
