import { describe, expect, it } from 'vitest'
import { CourierError, courierFetch, courierRefusalReason } from '../src/courier-error'
import { describeCourierFailure, describeCourierFailureForStaff } from '../src/estimate'

const reply = (status: number, body: string) => async () => new Response(body, { status })

describe('courier refusals keep their reason for staff', () => {
  it('reads remarks from a JSON 400 and shows it to staff, not shoppers', async () => {
    const err = await courierFetch('rapidshyp', 'https://x.test', {
      fetchImpl: reply(400, JSON.stringify({ status: false, remarks: 'Order id already exists' })),
    }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CourierError)
    expect((err as CourierError).status).toBe(400)
    expect((err as CourierError).reason).toBe('Order id already exists')
    expect(describeCourierFailureForStaff(err)).toBe(
      'The courier refused it: Order id already exists',
    )
    expect(describeCourierFailure(err)).toBe('The courier did not answer.')
  })

  it('joins nested error lists', async () => {
    const res = new Response(JSON.stringify({ errors: [{ message: 'pincode invalid' }, 'weight'] }))
    expect(await courierRefusalReason(res)).toBe('pincode invalid; weight')
  })

  it('ignores HTML error pages and empty bodies', async () => {
    expect(await courierRefusalReason(new Response('<html><body>Bad</body></html>'))).toBe(
      undefined,
    )
    expect(await courierRefusalReason(new Response(''))).toBe(undefined)
  })

  it('shows staff our own sentence for an answer we could not use', () => {
    const err = new CourierError(
      'bad_response',
      'rapidshyp',
      'RapidShyp created order 2471 but sent back no shipment id. Cancel it there before booking again.',
    )
    expect(describeCourierFailureForStaff(err)).toBe(err.message)
    expect(describeCourierFailure(err)).toBe('The courier answered with an error.')
  })

  it('keeps a 5xx as did not answer', async () => {
    const err = await courierFetch('rapidshyp', 'https://x.test', {
      fetchImpl: reply(502, JSON.stringify({ message: 'upstream' })),
    }).catch((e: unknown) => e)
    expect((err as CourierError).reason).toBe(undefined)
    expect(describeCourierFailureForStaff(err)).toBe('The courier did not answer.')
  })
})
