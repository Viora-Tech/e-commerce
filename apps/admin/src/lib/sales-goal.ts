/** A goal below ₹1 is meaningless. */
export const MIN_GOAL_PAISE = 100
/**
 * Hard ceiling for a single store's monthly sales goal: ₹1,00,00,000 (one crore). Generous
 * headroom above what any Waimers-scale merchant sells in a month today, while still
 * rejecting a fat-fingered typo like "50,00,88,888" (₹50 crore) typed with stray digits.
 */
export const MAX_GOAL_PAISE = 1_00_00_000_00

/** Parses a free-text rupee amount (digits, optional decimal/minus sign, commas ignored) into paise. */
export function parseRupeeInput(raw: string): number | null {
  const rupees = Number(raw.replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(rupees) || rupees <= 0) return null
  return Math.round(rupees * 100)
}

/** Whether a goal amount (in paise) falls within the sane range a merchant can set. */
export function isGoalInRange(paise: number): boolean {
  return paise >= MIN_GOAL_PAISE && paise <= MAX_GOAL_PAISE
}

/** Parses and range-checks in one step; null covers "unparsable" and "out of range" alike. */
export function sanitizeGoalInput(raw: string): number | null {
  const paise = parseRupeeInput(raw)
  if (paise === null || !isGoalInRange(paise)) return null
  return paise
}

/**
 * A sensible starting suggestion for a merchant who has never set a goal: last month's
 * total sales, rounded up to the nearest ten thousand rupees so it reads as a round target
 * rather than an exact figure. Null when there is no sales history to anchor to yet.
 */
export function suggestedGoalPaise(lastMonthSalesPaise: number): number | null {
  if (lastMonthSalesPaise <= 0) return null
  const roundToPaise = 10_000_00
  return Math.ceil(lastMonthSalesPaise / roundToPaise) * roundToPaise
}
