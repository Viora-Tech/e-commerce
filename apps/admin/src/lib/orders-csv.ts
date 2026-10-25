import type { OrderSheetRow } from '@commerce/api'
import type { ordersContent } from '@/data/orders'
import type { ordersBulkContent } from '@/data/orders-bulk'
import { toCsv } from '@/lib/csv'

type Copy = typeof ordersContent
type BulkCopy = typeof ordersBulkContent

/** The selected orders as a spreadsheet: one row each, contact, address, money and state. */
export function ordersCsv(copy: Copy, bulkCopy: BulkCopy, rows: readonly OrderSheetRow[]): string {
  const h = bulkCopy.csv
  return toCsv(
    [
      h.order,
      h.date,
      h.customer,
      h.email,
      h.phone,
      h.line1,
      h.line2,
      h.city,
      h.state,
      h.pincode,
      h.total,
      h.payment,
      h.fulfilment,
      h.status,
      h.tags,
    ],
    rows.map((r) => [
      `#${r.number}`,
      new Date(r.placedAt),
      r.name,
      r.email,
      r.phone,
      r.address?.line1,
      r.address?.line2,
      r.address?.city,
      r.address?.stateCode,
      r.address?.pincode,
      r.totalPaise / 100,
      copy.paymentStatus[r.paymentStatus],
      copy.fulfillmentStatus[r.fulfillmentStatus],
      copy.status[r.status],
      r.tags.join(', '),
    ]),
  )
}
