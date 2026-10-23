/** SOURCE OF TRUTH: EXPENSE_CATEGORIES, MONTHLY_EXPENSES, expensesForMonth, planExpenseEdit,
 *   countedDays, month maths ('YYYY-MM')
 * WHAT:  How the store's running costs (Settings › Monthly expenses) land in a month. Pure, no
 *        database: safe for client components (`@commerce/core/expenses`).
 * WHY:   Order profit alone hides rent, staff and software; net profit takes them off.
 *        MONTHLY_EXPENSES:
 *          an expense counts in every month from its first month to its last (none = running);
 *          a month the report covers only partly counts that share of each expense, by days:
 *          the month in progress counts the days so far ("so far"), so a half-gone month does
 *          not carry a whole month's rent against half a month's orders (owner, 23 Oct 2026);
 *          changing an expense from a later month ends the old version the month before and
 *          starts a new one, so a past month never changes (design anti-goal 2).
 * WHERE: finance/monthly-expense-service.ts stores them; api reports/profit.ts and the
 *        Monthly expenses page read these.
 */
/** What an expense is for. Same list as the table's check (@commerce/db finance-schema.ts). */
export const EXPENSE_CATEGORIES = [
  'staff',
  'rent',
  'software',
  'marketing',
  'utilities',
  'services',
  'other',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

/** A calendar month, `2026-10`. */
export type MonthKey = string

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/

export function isMonthKey(value: string): boolean {
  return MONTH.test(value)
}

/** `2026-10` from `2026-10-23` (or a month key itself). */
export function monthOf(isoDate: string): MonthKey {
  return isoDate.slice(0, 7)
}

function parts(month: MonthKey): [number, number] {
  const m = MONTH.exec(month)
  if (!m) throw new RangeError(`Not a month: ${month}`)
  return [Number(m[1]), Number(m[2])]
}

/** The month `n` months after (negative: before). */
export function shiftMonth(month: MonthKey, n: number): MonthKey {
  const [y, m] = parts(month)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function daysInMonth(month: MonthKey): number {
  const [y, m] = parts(month)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** One stored version of an expense, months as keys. */
export type ExpenseVersion = {
  id: string
  seriesId: string
  name: string
  category: ExpenseCategory
  amountPaise: number
  startsOn: MonthKey
  /** Last month it counts in; null while it keeps running. */
  endsOn: MonthKey | null
}

export function expenseApplies(e: Pick<ExpenseVersion, 'startsOn' | 'endsOn'>, month: MonthKey) {
  return e.startsOn <= month && (e.endsOn === null || month <= e.endsOn)
}

/**
 * How many days of `month` count: those in the report's days (`YYYY-MM-DD`) up to and
 * including today. A month wholly inside the days and over counts all of them.
 */
export function countedDays(month: MonthKey, days: readonly string[], today: string): number {
  return days.filter((d) => monthOf(d) === month && d <= today).length
}

export type MonthExpenses = {
  month: MonthKey
  /** Every expense that counts in the month, whole. */
  fullPaise: number
  /** The share for the days counted (MONTHLY_EXPENSES); equals `fullPaise` for a whole month. */
  countedPaise: number
  daysCounted: number
  daysInMonth: number
  /** The month is still going (today is in it). */
  inProgress: boolean
}

/** MONTHLY_EXPENSES for one month. */
export function expensesForMonth(
  expenses: readonly Pick<ExpenseVersion, 'amountPaise' | 'startsOn' | 'endsOn'>[],
  month: MonthKey,
  opts: { days: readonly string[]; today: string },
): MonthExpenses {
  const total = daysInMonth(month)
  const counted = countedDays(month, opts.days, opts.today)
  const fullPaise = expenses
    .filter((e) => expenseApplies(e, month))
    .reduce((n, e) => n + Math.max(0, e.amountPaise), 0)
  return {
    month,
    fullPaise,
    countedPaise: counted >= total ? fullPaise : Math.round((fullPaise * counted) / total),
    daysCounted: counted,
    daysInMonth: total,
    inProgress: monthOf(opts.today) === month,
  }
}

/** The new values for an expense, applied from `fromMonth` onwards. */
export type ExpenseEdit = {
  name: string
  category: ExpenseCategory
  amountPaise: number
  fromMonth: MonthKey
  endsOn: MonthKey | null
}

export type ExpenseEditPlan =
  | { kind: 'in_place'; startsOn: MonthKey; endsOn: MonthKey | null }
  | { kind: 'split'; closeAt: MonthKey; next: { startsOn: MonthKey; endsOn: MonthKey | null } }
  | { kind: 'invalid'; reason: 'after_end' | 'ends_before_start' }

/**
 * How an edit lands (MONTHLY_EXPENSES): from the version's first month or earlier, the version
 * changes in place; from a later month, the version ends the month before and a new one starts.
 */
export function planExpenseEdit(
  current: Pick<ExpenseVersion, 'startsOn' | 'endsOn'>,
  edit: Pick<ExpenseEdit, 'fromMonth' | 'endsOn'>,
): ExpenseEditPlan {
  if (current.endsOn !== null && edit.fromMonth > current.endsOn) {
    return { kind: 'invalid', reason: 'after_end' }
  }
  const startsOn = edit.fromMonth <= current.startsOn ? current.startsOn : edit.fromMonth
  if (edit.endsOn !== null && edit.endsOn < startsOn) {
    return { kind: 'invalid', reason: 'ends_before_start' }
  }
  if (startsOn === current.startsOn) return { kind: 'in_place', startsOn, endsOn: edit.endsOn }
  return {
    kind: 'split',
    closeAt: shiftMonth(edit.fromMonth, -1),
    next: { startsOn, endsOn: edit.endsOn },
  }
}
