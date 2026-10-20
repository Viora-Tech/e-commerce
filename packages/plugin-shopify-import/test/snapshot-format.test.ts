import { describe, expect, it } from 'vitest'
import { SNAPSHOT_FORMAT } from '../src/client'
import { freshSnapshot } from '../src/snapshot'

const now = Date.parse('2026-10-20T12:00:00Z')
const copy = (format?: number) => ({
  takenAt: new Date(now - 60_000).toISOString(),
  ...(format === undefined ? {} : { format }),
  streams: {},
})

describe('preview copy format', () => {
  it('reuses a fresh copy saved in the current format', () => {
    expect(freshSnapshot(copy(SNAPSHOT_FORMAT), now)).not.toBeNull()
  })

  it('reads Shopify again for a copy saved by older code, which lacks newer fields', () => {
    expect(freshSnapshot(copy(), now)).toBeNull()
    expect(freshSnapshot(copy(SNAPSHOT_FORMAT - 1), now)).toBeNull()
  })
})
