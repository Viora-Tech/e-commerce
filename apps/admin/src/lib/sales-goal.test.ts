import { describe, expect, it } from 'vitest'
import {
  isGoalInRange,
  MAX_GOAL_PAISE,
  parseRupeeInput,
  sanitizeGoalInput,
  suggestedGoalPaise,
} from './sales-goal'

describe('parseRupeeInput', () => {
  it('strips commas and reads a plain rupee amount', () => {
    expect(parseRupeeInput('50,000')).toBe(50_000_00)
  })

  it('rejects zero, negative and non-numeric input', () => {
    expect(parseRupeeInput('0')).toBeNull()
    expect(parseRupeeInput('-5')).toBeNull()
    expect(parseRupeeInput('')).toBeNull()
    expect(parseRupeeInput('abc')).toBeNull()
  })
})

describe('sanitizeGoalInput', () => {
  it('accepts a reasonable monthly goal', () => {
    expect(sanitizeGoalInput('2,50,000')).toBe(2_50_000_00)
  })

  it('rejects the fat-fingered "50,00,88,888" that produced the reported bug', () => {
    // Typed while mentally grouping lakhs/crores; commas stripped this becomes 50 crore rupees.
    expect(sanitizeGoalInput('50,00,88,888')).toBeNull()
  })

  it('rejects any amount above the sane ceiling', () => {
    expect(isGoalInRange(MAX_GOAL_PAISE)).toBe(true)
    expect(isGoalInRange(MAX_GOAL_PAISE + 1)).toBe(false)
    expect(sanitizeGoalInput(String(MAX_GOAL_PAISE / 100 + 1))).toBeNull()
  })

  it('rejects an amount below one rupee', () => {
    expect(sanitizeGoalInput('0.5')).toBeNull()
  })
})

describe('suggestedGoalPaise', () => {
  it('rounds last month’s sales up to the nearest ten thousand rupees', () => {
    expect(suggestedGoalPaise(2_75_737_00)).toBe(2_80_000_00)
  })

  it('returns null when there is no sales history yet', () => {
    expect(suggestedGoalPaise(0)).toBeNull()
  })
})
