import { describe, expect, it } from 'vitest'
import { BULK_BACKLOG, mediaProcessLimits, profileFor } from './media-limits'

describe('mediaProcessLimits', () => {
  it('defaults to 3 at once and 2 per store, so one store never fills every slot', () => {
    expect(mediaProcessLimits({})).toEqual({ concurrency: 3, perStore: 2 })
  })

  it('takes both from the env', () => {
    expect(
      mediaProcessLimits({ MEDIA_PROCESS_CONCURRENCY: 6, MEDIA_PROCESS_PER_STORE: 2 }),
    ).toEqual({
      concurrency: 6,
      perStore: 2,
    })
  })

  it('never lets the per-store cap exceed the concurrency', () => {
    expect(
      mediaProcessLimits({ MEDIA_PROCESS_CONCURRENCY: 2, MEDIA_PROCESS_PER_STORE: 5 }),
    ).toEqual({
      concurrency: 2,
      perStore: 2,
    })
  })
})

describe('profileFor', () => {
  it('uses the bulk profile only for bulk jobs', () => {
    expect(profileFor({ bulk: true })).toBe('bulk')
    expect(profileFor({})).toBe('interactive')
    expect(profileFor({ bulk: false })).toBe('interactive')
  })

  it('also uses it behind a long backlog of the same store, e.g. jobs queued before the flag existed', () => {
    expect(profileFor({}, BULK_BACKLOG - 1)).toBe('interactive')
    expect(profileFor({}, BULK_BACKLOG)).toBe('bulk')
  })
})
