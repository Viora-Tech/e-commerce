import { decryptCustomerPhone } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { customer } from '@commerce/db'
import { inArray } from 'drizzle-orm'

/** One customer as the bulk-edit spreadsheet shows it: details, tags, note and consent. */
export type CustomerSheetRow = {
  id: string
  email: string
  name: string
  phone: string
  tags: string[]
  note: string
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
      acceptsMarketing: customer.acceptsMarketing,
      acceptsWhatsapp: customer.acceptsWhatsapp,
      acceptsSms: customer.acceptsSms,
      anonymisedAt: customer.anonymisedAt,
    })
    .from(customer)
    .where(inArray(customer.id, ids))
  const byId = new Map(rows.map((r) => [r.id, r]))
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
      acceptsMarketing: r.acceptsMarketing,
      acceptsWhatsapp: r.acceptsWhatsapp,
      acceptsSms: r.acceptsSms,
      anonymised: r.anonymisedAt !== null,
    })
  }
  return sheet
}
