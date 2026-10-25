import type { OrderFulfillmentStatus, OrderPaymentStatus, OrderStatus } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { address, customer, order } from '@commerce/db'
import { and, eq, inArray, ne } from 'drizzle-orm'

/** One order as the bulk-edit spreadsheet shows it: contact, shipping address, tags, state. */
export type OrderSheetRow = {
  id: string
  number: number
  placedAt: Date
  name: string
  email: string
  phone: string
  address: {
    line1: string
    line2: string | null
    city: string
    stateCode: string
    pincode: string
  } | null
  tags: string[]
  /** For the list's CSV export; the sheet itself does not show it. */
  totalPaise: number
  paymentStatus: OrderPaymentStatus
  fulfillmentStatus: OrderFulfillmentStatus
  status: OrderStatus
  /** Brought over by an import: read-only except tags. */
  imported: boolean
}

/**
 * The rows for the bulk-edit sheet, one per requested order and in the requested order. One
 * query: the order, its shipping-address snapshot and its customer. The contact name is the
 * parcel's name, else the customer's (gift cards have no address). Unknown ids are skipped.
 */
export async function orderSheet(tx: StoreTx, ids: string[]): Promise<OrderSheetRow[]> {
  const rows = await tx
    .select({
      id: order.id,
      number: order.number,
      placedAt: order.placedAt,
      email: order.email,
      phone: order.phone,
      tags: order.tags,
      totalPaise: order.totalPaise,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      status: order.status,
      importedFrom: order.importedFrom,
      addressId: address.id,
      addressName: address.name,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      stateCode: address.stateCode,
      pincode: address.pincode,
      customerName: customer.name,
    })
    .from(order)
    .leftJoin(address, eq(address.id, order.shippingAddressId))
    .leftJoin(customer, eq(customer.id, order.customerId))
    .where(and(inArray(order.id, ids), ne(order.status, 'draft')))
  const byId = new Map(rows.map((r) => [r.id, r]))
  const sheet: OrderSheetRow[] = []
  for (const id of ids) {
    const r = byId.get(id)
    if (!r) continue
    sheet.push({
      id: r.id,
      number: r.number,
      placedAt: r.placedAt,
      name: r.addressName ?? r.customerName ?? '',
      email: r.email ?? '',
      phone: r.phone ?? '',
      address:
        r.addressId === null
          ? null
          : {
              line1: r.line1 ?? '',
              line2: r.line2,
              city: r.city ?? '',
              stateCode: r.stateCode ?? '',
              pincode: r.pincode ?? '',
            },
      tags: r.tags ?? [],
      totalPaise: r.totalPaise,
      paymentStatus: r.paymentStatus as OrderPaymentStatus,
      fulfillmentStatus: r.fulfillmentStatus as OrderFulfillmentStatus,
      status: r.status as OrderStatus,
      imported: r.importedFrom !== null,
    })
  }
  return sheet
}
