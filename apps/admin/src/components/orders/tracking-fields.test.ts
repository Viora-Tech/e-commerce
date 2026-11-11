import { describe, expect, it } from 'vitest'
import { EMPTY_TRACKING, trackingPayload } from './tracking-fields'

describe('trackingPayload', () => {
  it("sends an Other courier's name, number and typed tracking link", () => {
    expect(
      trackingPayload({
        ...EMPTY_TRACKING,
        trackingNumber: ' LC123 ',
        otherName: 'Local courier',
        otherUrl: 'https://track.local.test/LC123',
      }),
    ).toEqual({
      courier: 'Local courier',
      trackingNumber: 'LC123',
      trackingUrl: 'https://track.local.test/LC123',
    })
  })

  it('drops a typed link that is not a web address', () => {
    const p = trackingPayload({ ...EMPTY_TRACKING, otherName: 'Hand', otherUrl: 'javascript:x' })
    expect(p).toEqual({ courier: 'Hand' })
  })
})
