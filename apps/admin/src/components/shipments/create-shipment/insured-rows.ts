import type { CourierRateRow } from '@commerce/core'
import { assignBadges } from '@commerce/core/courier-badges'

/**
 * What the drawer's Shipping insurance switch does to one row. `off`: the switch is off.
 * `added`: its fee and the fee's 18% GST (Delhivery Protect, RapidShyp's rate or the route's)
 * are added to the price and shown as their own breakdown lines. `included`: the courier's
 * quote already itemised it. `unset`: no rate is known, so nothing is added and the row says
 * "Insurance rate not set".
 */
export type RowInsuranceState =
  | { kind: 'off' }
  | {
      kind: 'added'
      feePaise: number
      gstPaise: number
      pricePaise: number
      /** RapidShyp's published rate: its own figure can differ (a part-shipped order was billed
       *  on 110% of the value), so the drawer marks it as an estimate. Protect is exact. */
      estimate: boolean
      /** Shiprocket's 1.05% already holds GST: one line, "incl. GST". */
      gstIncluded: boolean
      /** The rate the fee was worked out at (basis points); null when a route minimum set it. */
      rateBps: number | null
    }
  | { kind: 'included'; pricePaise: number }
  | { kind: 'unset' }

export function rowInsuranceState(
  row: Pick<CourierRateRow, 'insurance'>,
  insured: boolean,
): RowInsuranceState {
  if (!insured) return { kind: 'off' }
  const ins = row.insurance
  if (!ins) return { kind: 'unset' }
  return ins.source === 'courier'
    ? { kind: 'included', pricePaise: ins.pricePaise }
    : {
        kind: 'added',
        feePaise: ins.feePaise,
        gstPaise: ins.gstPaise,
        pricePaise: ins.pricePaise,
        estimate: ins.estimate,
        gstIncluded: ins.gstIncluded,
        rateBps: ins.rateBps ?? null,
      }
}

/**
 * The rows as the merchant pays for them. With insurance on, each row whose fee is known but not
 * in its quote gets the fee and its GST in its price (the table lists them as Insurance and
 * Insurance GST); Cheapest, Fastest and Recommended are then worked out again on those totals,
 * which the Sort uses too. With insurance off, the rows are the courier's own prices.
 */
export function insuredRows(rows: readonly CourierRateRow[], insured: boolean): CourierRateRow[] {
  if (!insured) return [...rows]
  return assignBadges(
    rows.map((row) => {
      const state = rowInsuranceState(row, true)
      if (state.kind !== 'added' || row.pricePaise === null || row.problem !== null) return row
      return { ...row, pricePaise: row.pricePaise + state.pricePaise }
    }),
  )
}
