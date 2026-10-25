import { decryptCustomerPhone } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { customer, customerAddress } from '@commerce/db'
import { and, eq, inArray } from 'drizzle-orm'

/** The customer's default address-book entry, whole, so a city or PIN edit can resave it. */
export type CustomerSheetAddress = {
  id: string
  name: string
  line1: string
  line2: string | null
  city: string
  stateCode: string
  pincode: string
  phone: string
}

/**
 * One customer as the bulk-edit spreadsheet shows it: details, business details, tags, note,
 * consent and the default address.
 */
export type CustomerSheetRow = {
  id: string
  email: string
  name: string
  phone: string
  tags: string[]
  note: string
  gstin: string
  businessName: string
  /** Null when the customer has no default address in their book: its cells are read-only. */
  defaultAddress: CustomerSheetAddress | null
  acceptsMarketing: boolean
  acceptsWhatsapp: boolean
  acceptsSms: boolean
  /** Erased under a privacy request: nothing about them can change. */
  anonymised: boolean
}

/**
 * The rows for the bulk-edit sheet, one per requested customer and in the requested order.
 * Phones are decrypted here, like everywhere a customer is shown. Unknown ids are skipped.
 */
export async function customerSheet(
  tx: StoreTx,
  ids: string[],
  secret: string,
): Promise<CustomerSheetRow[]> {
  const rows = await tx
    .select({
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      tags: customer.tags,
      note: customer.note,
      gstin: customer.gstin,
      businessName: customer.businessName,
      acceptsMarketing: customer.acceptsMarketing,
      acceptsWhatsapp: customer.acceptsWhatsapp,
      acceptsSms: customer.acceptsSms,
      anonymisedAt: customer.anonymisedAt,
    })
    .from(customer)
    .where(inArray(customer.id, ids))
  const byId = new Map(rows.map((r) => [r.id, r]))
  const addresses = await tx
    .select({
      customerId: customerAddress.customerId,
      id: customerAddress.id,
      name: customerAddress.name,
      line1: customerAddress.line1,
      line2: customerAddress.line2,
      city: customerAddress.city,
      stateCode: customerAddress.stateCode,
      pincode: customerAddress.pincode,
      phone: customerAddress.phone,
    })
    .from(customerAddress)
    .where(and(inArray(customerAddress.customerId, ids), eq(customerAddress.isDefault, true)))
  const addressOf = new Map(addresses.map(({ customerId, ...a }) => [customerId, a]))
  const sheet: CustomerSheetRow[] = []
  for (const id of ids) {
    const r = byId.get(id)
    if (!r) continue
    sheet.push({
      id: r.id,
      email: r.email ?? '',
      name: r.name ?? '',
      phone: decryptCustomerPhone(r.phone, secret) ?? '',
      tags: r.tags ?? [],
      note: r.note ?? '',
      gstin: r.gstin ?? '',
      businessName: r.businessName ?? '',
      defaultAddress: addressOf.get(r.id) ?? null,
      acceptsMarketing: r.acceptsMarketing,
      acceptsWhatsapp: r.acceptsWhatsapp,
      acceptsSms: r.acceptsSms,
      anonymised: r.anonymisedAt !== null,
    })
  }
  return sheet
}
