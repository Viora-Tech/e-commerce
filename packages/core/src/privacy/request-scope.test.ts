/** SOURCE OF TRUTH: data request scope tests — an export or erasure only answers a request for the same customer */
import { describe, expect, it } from 'vitest'
import { requestMatchesCustomer } from './requests'

describe('requestMatchesCustomer', () => {
  it('lets a request answer only its own customer', () => {
    expect(requestMatchesCustomer('customer-x', 'customer-x')).toBe(true)
    expect(requestMatchesCustomer('customer-y', 'customer-x')).toBe(false)
  })

  it('lets a request not yet linked to anyone be answered', () => {
    expect(requestMatchesCustomer(null, 'customer-x')).toBe(true)
  })
})
