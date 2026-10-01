import { CourierError } from '@commerce/shipping'
import { describe, expect, it } from 'vitest'
import { courierAuthFailure } from './shipments-webhook'

describe('courierAuthFailure', () => {
  it('answers a bad courier token with 401, not a 500 the courier retries', () => {
    expect(courierAuthFailure(new CourierError('auth', 'delhivery', 'bad token'))).toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it('rethrows anything else', () => {
    const boom = new Error('database down')
    expect(() => courierAuthFailure(boom)).toThrow(boom)
  })
})
