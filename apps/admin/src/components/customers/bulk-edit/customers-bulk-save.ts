import { api } from '@/lib/api-client'
import {
  ADDRESS_KEYS,
  addressPayload,
  CONSENT_KEYS,
  type ConsentKey,
  DETAIL_KEYS,
  detailPayload,
  EDITABLE_KEYS,
  type GridRow,
  isDirty,
} from './customers-bulk-model'

/** "Select all" can hand over thousands of customers: ten at a time, never all at once. */
const BATCH = 10

/** What happened to one row: the cells that saved, and the first server message if one failed. */
export type RowResult = { id: string; done: string[]; error: string | null }

const messageOf = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback

async function saveRow(row: GridRow, base: GridRow, fallback: string): Promise<RowResult> {
  const done: string[] = []
  try {
    const details = DETAIL_KEYS.filter((k) => isDirty(row, base, k))
    if (details.length > 0) {
      await api.customers.update({ id: row.id, ...detailPayload(row, base) })
      done.push(...details)
    }
    const address = addressPayload(row, base)
    if (address) {
      await api.customers.updateAddress(address)
      done.push(...ADDRESS_KEYS.filter((k) => isDirty(row, base, k)))
    }
    // Consent goes through the consent writer, one channel at a time, so each change is in
    // the customer's history.
    for (const key of Object.keys(CONSENT_KEYS) as ConsentKey[]) {
      if (!isDirty(row, base, key)) continue
      await api.customerPrivacy.setConsent({
        customerId: row.id,
        channel: CONSENT_KEYS[key],
        granted: row[key] === 'yes',
      })
      done.push(key)
    }
    return { id: row.id, done, error: null }
  } catch (err) {
    return { id: row.id, done, error: messageOf(err, fallback) }
  }
}

/** Rows with at least one changed cell. */
export const dirtyRows = (rows: GridRow[], base: Map<string, GridRow>) =>
  rows.filter((r) => EDITABLE_KEYS.some((k) => isDirty(r, base.get(r.id), k)))

/** Save each changed row (details, default address, then consent), BATCH rows at a time. */
export async function saveRows(rows: GridRow[], base: Map<string, GridRow>, fallback: string) {
  const results: RowResult[] = []
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    results.push(
      ...(await Promise.all(
        chunk.flatMap((r) => {
          const b = base.get(r.id)
          return b ? [saveRow(r, b, fallback)] : []
        }),
      )),
    )
  }
  return results
}
