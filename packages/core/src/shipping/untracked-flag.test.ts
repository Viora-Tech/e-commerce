/** SOURCE OF TRUTH: tests for ./untracked-flag.ts — when a shipment the courier has no record of is flagged. */
import { describe, expect, it } from 'vitest'
import { UNTRACKED_GRACE_MS, untrackedCreatedShipment, untrackedNoteBody } from './untracked-flag'

describe('untrackedCreatedShipment', () => {
  const now = new Date('2026-11-27T14:00:00Z')
  const ago = (ms: number) => new Date(now.getTime() - ms)

  it('flags a Label created shipment older than 30 minutes', () => {
    expect(
      untrackedCreatedShipment({ status: 'created', createdAt: ago(UNTRACKED_GRACE_MS) }, now),
    ).toBe(true)
    expect(untrackedCreatedShipment({ status: 'created', createdAt: ago(6 * 3600_000) }, now)).toBe(
      true,
    )
  })

  it('leaves a fresh booking alone: the courier may not have it yet', () => {
    expect(untrackedCreatedShipment({ status: 'created', createdAt: ago(10 * 60_000) }, now)).toBe(
      false,
    )
  })

  it('leaves a parcel that has moved on alone', () => {
    expect(
      untrackedCreatedShipment({ status: 'in_transit', createdAt: ago(86_400_000) }, now),
    ).toBe(false)
  })

  it('writes the same words for the same waybill, so the note is written once', () => {
    expect(untrackedNoteBody('Delhivery', 'W1')).toBe(untrackedNoteBody('Delhivery', 'W1'))
    expect(untrackedNoteBody('Delhivery', 'W1')).toContain('Delhivery has no record of waybill W1')
  })
})
