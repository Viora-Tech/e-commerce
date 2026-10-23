/** SOURCE OF TRUTH: PROFIT_AVERAGES, profitAverages, basketSizeOf, profitVerdict
 * WHAT:  Averages a seller can trust over many orders: profit per order, per unit and by basket
 *        size, how many orders are still estimated, and whether the period paid its expenses.
 *        Pure, no database: safe for client components (`@commerce/core/expenses`).
 * WHY:   One order's profit is an estimate; the average over time is what to price on, and a
 *        bigger basket pays one delivery and one box, so it earns more per unit
 *        (docs/superpowers/specs/2026-10-22-profit-design.md §5).
 *        PROFIT_AVERAGES:
 *          per order  = Σ order profit ÷ orders
 *          per unit   = Σ order profit ÷ units sold (units not put back in stock)
 *          by basket  = per order, within orders of 1, 2 and 3+ units
 *          estimated  = orders whose packing, delivery or payment fee is still an estimate;
 *                       every figure is a floor ("at least") while any are
 *          verdict    = net profit ≥ 0: profitable; else short by −net profit, about
 *                       ⌈short ÷ average order profit⌉ more orders (none when it is ≤ 0)
 * WHERE: api reports/profit.ts builds the Profit reports' summary; the admin shows it.
 */

export const BASKET_SIZES = ['1', '2', '3+'] as const
export type BasketSize = (typeof BASKET_SIZES)[number]

export function basketSizeOf(units: number): BasketSize {
  return units <= 1 ? '1' : units === 2 ? '2' : '3+'
}

/** One order as the averages need it. */
export type ProfitSample = { profitPaise: number; units: number; estimated: boolean }

export type ProfitAverages = {
  orders: number
  estimatedOrders: number
  units: number
  profitPaise: number
  perOrderPaise: number | null
  perUnitPaise: number | null
  byBasket: { size: BasketSize; orders: number; perOrderPaise: number | null }[]
}

const avg = (sum: number, count: number) => (count > 0 ? Math.round(sum / count) : null)

/** PROFIT_AVERAGES over a set of orders. */
export function profitAverages(samples: readonly ProfitSample[]): ProfitAverages {
  const profitPaise = samples.reduce((n, s) => n + s.profitPaise, 0)
  const units = samples.reduce((n, s) => n + Math.max(0, s.units), 0)
  return {
    orders: samples.length,
    estimatedOrders: samples.filter((s) => s.estimated).length,
    units,
    profitPaise,
    perOrderPaise: avg(profitPaise, samples.length),
    perUnitPaise: avg(profitPaise, units),
    byBasket: BASKET_SIZES.map((size) => {
      const group = samples.filter((s) => s.units > 0 && basketSizeOf(s.units) === size)
      return {
        size,
        orders: group.length,
        perOrderPaise: avg(
          group.reduce((n, s) => n + s.profitPaise, 0),
          group.length,
        ),
      }
    }),
  }
}

export type ProfitVerdict =
  | { kind: 'profitable' }
  | { kind: 'short'; shortPaise: number; ordersNeeded: number | null }

/** PROFIT_AVERAGES verdict: did the orders pay the expenses, and if not, by how much. */
export function profitVerdict(netProfitPaise: number, perOrderPaise: number | null): ProfitVerdict {
  if (netProfitPaise >= 0) return { kind: 'profitable' }
  const shortPaise = -netProfitPaise
  return {
    kind: 'short',
    shortPaise,
    ordersNeeded:
      perOrderPaise !== null && perOrderPaise > 0 ? Math.ceil(shortPaise / perOrderPaise) : null,
  }
}
