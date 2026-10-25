/** SOURCE OF TRUTH: monthly expense maths tests — WHAT: months, prorating and edits / WHY: guards net profit */
import { MONTHLY_EXPENSE_CATEGORIES } from '@commerce/db'
import { describe, expect, it } from 'vitest'
import {
  countedDays,
  daysInMonth,
  EXPENSE_CATEGORIES,
  expenseApplies,
  expensesForMonth,
  planExpenseEdit,
  shiftMonth,
} from './monthly-expenses'

/** Every day of a month, `2026-10-01` … */
const daysOf = (month: string) =>
  Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)

const rent = { amountPaise: 3_100_000, startsOn: '2026-01', endsOn: null }
const app = { amountPaise: 99_900, startsOn: '2026-09', endsOn: '2026-10' }

describe('months', () => {
  it('knows month lengths and moves across years', () => {
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('the categories match the table check', () => {
    expect([...EXPENSE_CATEGORIES]).toEqual([...MONTHLY_EXPENSE_CATEGORIES])
  })

  it('an expense counts from its first to its last month', () => {
    expect(expenseApplies(app, '2026-08')).toBe(false)
    expect(expenseApplies(app, '2026-09')).toBe(true)
    expect(expenseApplies(app, '2026-10')).toBe(true)
    expect(expenseApplies(app, '2026-11')).toBe(false)
    expect(expenseApplies(rent, '2030-05')).toBe(true)
  })
})

describe('expensesForMonth', () => {
  it('a finished month counts every expense whole', () => {
    const m = expensesForMonth([rent, app], '2026-09', {
      days: daysOf('2026-09'),
      today: '2026-10-23',
    })
    expect(m).toMatchObject({
      fullPaise: 3_199_900,
      countedPaise: 3_199_900,
      daysCounted: 30,
      inProgress: false,
    })
  })

  it('the month in progress counts the days so far', () => {
    const m = expensesForMonth([rent], '2026-10', { days: daysOf('2026-10'), today: '2026-10-23' })
    // ₹31,000 × 23 / 31 days = ₹23,000
    expect(m).toMatchObject({
      fullPaise: 3_100_000,
      countedPaise: 2_300_000,
      daysCounted: 23,
      daysInMonth: 31,
      inProgress: true,
    })
  })

  it('a report covering part of a past month counts that part', () => {
    const days = daysOf('2026-09').slice(15)
    expect(countedDays('2026-09', days, '2026-10-23')).toBe(15)
    const m = expensesForMonth([rent], '2026-09', { days, today: '2026-10-23' })
    expect(m.countedPaise).toBe(1_550_000)
  })
})

describe('planExpenseEdit', () => {
  const current = { startsOn: '2026-01', endsOn: null }

  it('from the first month or before: changes in place', () => {
    expect(planExpenseEdit(current, { fromMonth: '2026-01', endsOn: null })).toEqual({
      kind: 'in_place',
      startsOn: '2026-01',
      endsOn: null,
    })
    expect(planExpenseEdit(current, { fromMonth: '2025-06', endsOn: null }).kind).toBe('in_place')
  })

  it('from a later month: the old version ends the month before, past months keep it', () => {
    expect(planExpenseEdit(current, { fromMonth: '2026-11', endsOn: null })).toEqual({
      kind: 'split',
      closeAt: '2026-10',
      next: { startsOn: '2026-11', endsOn: null },
    })
  })

  it('refuses an edit after the expense ended, or ending before it starts', () => {
    expect(
      planExpenseEdit(
        { startsOn: '2026-01', endsOn: '2026-03' },
        { fromMonth: '2026-05', endsOn: null },
      ),
    ).toEqual({ kind: 'invalid', reason: 'after_end' })
    expect(planExpenseEdit(current, { fromMonth: '2026-05', endsOn: '2026-04' })).toEqual({
      kind: 'invalid',
      reason: 'ends_before_start',
    })
  })
})
