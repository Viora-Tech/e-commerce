import { CourierError } from '@commerce/shipping'
import { describe, expect, it } from 'vitest'
import { courierAuthFailure } from './shipments-webhook'

describe('courierAuthFailure', () => {
  it('turns a bad courier token into a rejection, not a 500 the courier retries', () => {
    expect(courierAuthFailure(new CourierError('auth', 'delhivery', 'bad token'))).toMatchObject({
      ok: false,
      reason: 'unauthorised',
    })
  })

  it('rethrows anything else', () => {
    const boom = new Error('database down')
    expect(() => courierAuthFailure(boom)).toThrow(boom)
  })
})
