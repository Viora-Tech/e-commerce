import { describe, expect, it } from 'vitest'
import { loyaltyContent } from '@/data/loyalty'
import { pointsEntryKind } from './loyalty-entry'

const copy = loyaltyContent

describe('pointsEntryKind', () => {
  it('reads a staff removal as Removed, never Credited', () => {
    expect(pointsEntryKind({ source: 'adjustment', status: 'credited', points: -20 }, copy)).toBe(
      'Removed',
    )
  })

  it('reads a staff addition as Added', () => {
    expect(pointsEntryKind({ source: 'adjustment', status: 'credited', points: 50 }, copy)).toBe(
      'Added',
    )
  })

  it('keeps the status for earned points', () => {
    expect(pointsEntryKind({ source: 'order', status: 'pending', points: 12 }, copy)).toBe(
      'Order · On the way',
    )
    expect(pointsEntryKind({ source: 'order', status: 'credited', points: 12 }, copy)).toBe(
      'Order · Credited',
    )
    expect(pointsEntryKind({ source: 'order', status: 'cancelled', points: 12 }, copy)).toBe(
      'Order · Cancelled',
    )
  })

  it('never says Credited on points taken away', () => {
    expect(pointsEntryKind({ source: 'reversal', status: 'credited', points: -12 }, copy)).toBe(
      'Taken back',
    )
  })
})
