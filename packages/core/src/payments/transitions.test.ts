import { describe, expect, it } from 'vitest'
import { nextPaymentStatus } from './transitions'

describe('nextPaymentStatus', () => {
  it.each([
    ['created', 'pending', 'pending'],
    ['created', 'captured', 'captured'],
    ['pending', 'authorized', 'authorized'],
    ['authorized', 'captured', 'captured'],
    ['pending', 'failed', 'failed'],
    ['authorized', 'failed', 'failed'],
    ['captured', 'refunded', 'refunded'],
    // a failed payment inside one gateway order can be followed by a good one
    ['failed', 'captured', 'captured'],
    ['cancelled', 'captured', 'captured'],
    ['failed', 'authorized', 'authorized'],
  ] as const)('%s + %s moves to %s', (current, incoming, next) => {
    expect(nextPaymentStatus(current, incoming)).toBe(next)
  })

  it.each([
    ['captured', 'captured'],
    ['captured', 'failed'],
    ['captured', 'pending'],
    ['captured', 'authorized'],
    ['refunded', 'captured'],
    ['refunded', 'failed'],
    ['authorized', 'pending'],
    ['failed', 'failed'],
    ['failed', 'pending'],
    ['cancelled', 'failed'],
    ['pending', 'refunded'],
  ] as const)('%s ignores a late or repeated %s', (current, incoming) => {
    expect(nextPaymentStatus(current, incoming)).toBeNull()
  })
})
