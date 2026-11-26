/** SOURCE OF TRUTH: the affiliate portal's exports — WHAT: an affiliate's own commissions and payouts as CSV / WHY: UpPromote's portal lets affiliates export both; the buyer stays masked and cells cannot run as spreadsheet formulas */

import { csvCell, rupees } from './payouts'
import type { PortalPayout, PortalSale } from './portal'

const indiaDate = (d: Date | null): string =>
  d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10) : ''

const line = (cells: (string | number)[]) => cells.map(csvCell).join(',')

/** Their commissions: date, customer (masked), source, status, sale and commission in rupees. */
export function portalCommissionsCsv(rows: PortalSale[]): string {
  const head = line([
    'Date',
    'Customer',
    'Source',
    'Status',
    'Sale (INR)',
    'Commission (INR)',
    'Payable from',
  ])
  const body = rows.map((r) =>
    line([
      indiaDate(r.placedAt),
      r.buyer ?? '',
      r.source,
      r.held ? 'held' : r.status,
      rupees(r.basePaise),
      rupees(r.commissionPaise),
      indiaDate(r.eligibleAt),
    ]),
  )
  return `${[head, ...body].join('\r\n')}\r\n`
}

/** Their payouts: created, paid, status, commission, TDS, returned orders, GST, net, reference. */
export function portalPayoutsCsv(rows: PortalPayout[]): string {
  const head = line([
    'Created',
    'Paid',
    'Status',
    'Commission (INR)',
    'TDS (INR)',
    'Returned orders (INR)',
    'GST (INR)',
    'Paid to you (INR)',
    'Reference',
  ])
  const body = rows.map((r) =>
    line([
      indiaDate(r.createdAt),
      indiaDate(r.paidAt),
      r.status,
      rupees(r.grossPaise),
      rupees(r.tdsPaise),
      rupees(r.clawbackPaise),
      rupees(r.gstPaise),
      rupees(r.netPaise),
      r.reference,
    ]),
  )
  return `${[head, ...body].join('\r\n')}\r\n`
}
