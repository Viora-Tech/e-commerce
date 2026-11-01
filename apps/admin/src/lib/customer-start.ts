/**
 * When someone became a customer: their first order when it is older than their record (an
 * import or a later sign-up made the record after they had ordered, audit #43).
 */
export function customerStart(c: {
  createdAt: Date | string
  totals: { firstOrderAt: Date | string | null }
}): Date | string {
  const first = c.totals.firstOrderAt
  return first && new Date(first).getTime() < new Date(c.createdAt).getTime() ? first : c.createdAt
}
