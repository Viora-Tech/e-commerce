/** Tenures Snapmint and card EMI commonly offer, in months. */
export const EMI_TENURES_MONTHS = [3, 6, 9, 12] as const

/**
 * Equal monthly instalment for a flat-rate (no-cost) plan: the lender's
 * interest is usually absorbed as a merchant subvention, so the shopper sees
 * amount / months. Rounded up so the sum never undershoots the price.
 */
export function monthlyEmiPaise(totalPaise: number, months: number): number {
  if (!Number.isInteger(totalPaise) || totalPaise < 0)
    throw new RangeError('totalPaise must be a non-negative integer')
  if (!Number.isInteger(months) || months < 1)
    throw new RangeError('months must be a positive integer')
  return Math.ceil(totalPaise / months)
}

/** Lowest instalment across the offered tenures, i.e. the "from ₹X/month" number. */
export function lowestEmiPaise(
  totalPaise: number,
  tenures: readonly number[] = EMI_TENURES_MONTHS,
): number {
  const longest = Math.max(...tenures)
  return monthlyEmiPaise(totalPaise, longest)
}
