/** The rates Analytics and the team reports state, pure so both read the same numbers. */

/**
 * Share of sessions that placed an order, 0 when nobody visited. Capped at 1 (100%):
 * a session count that undercounts real traffic (e.g. a visitor beacon gap) must never
 * inflate this past a sensible ceiling.
 */
export function conversionRate(orders: number, sessions: number): number {
  return sessions > 0 ? Math.min(orders / sessions, 1) : 0
}

/** Mean order value in paise, rounded to the paisa. */
export function averageOrderValue(revenuePaise: number, orders: number): number {
  return orders > 0 ? Math.round(revenuePaise / orders) : 0
}

/** Share of orders placed by someone who had ordered before. */
export function returningRate(returningOrders: number, orders: number): number {
  return orders > 0 ? returningOrders / orders : 0
}

/** Fractional change against the previous period; null when there is nothing to compare. */
export function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return (current - previous) / previous
}
