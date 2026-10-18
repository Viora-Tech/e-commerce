import { api } from '@/lib/api-client'
import {
  CONTACT_KEYS,
  contactPayload,
  EDITABLE_KEYS,
  type GridRow,
  isDirty,
  type Mark,
  parseTags,
} from './orders-bulk-model'

/** "Select all" can hand over thousands of orders: ten at a time, never all at once. */
const BATCH = 10

type Part = 'contact' | 'tags' | 'mark'

/** What happened to one row: the parts that saved, and the first server message if one failed. */
export type RowResult = { id: string; done: Part[]; error: string | null }

const PART_KEYS: Record<Part, readonly string[]> = {
  contact: CONTACT_KEYS,
  tags: ['tags'],
  mark: ['mark'],
}

const messageOf = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback

/** The keys of the parts that saved, to copy from the saved row into the new baseline. */
export const savedKeys = (done: Part[]) => done.flatMap((p) => PART_KEYS[p])

async function saveRow(row: GridRow, base: GridRow, fallback: string): Promise<RowResult> {
  const done: Part[] = []
  const changed = (part: Part) => PART_KEYS[part].some((k) => isDirty(row, base, k))
  try {
    if (changed('contact')) {
      await api.orders.updateContact({
        orderId: row.id,
        ...contactPayload(row),
        alsoUpdateCustomer: false,
      })
      done.push('contact')
    }
    if (changed('tags')) {
      await api.orders.setTags({ id: row.id, tags: parseTags(row.tags) })
      done.push('tags')
    }
    if (changed('mark') && row.mark) {
      await api.orders.setStatus({ id: row.id, status: row.mark as Mark })
      done.push('mark')
    }
    return { id: row.id, done, error: null }
  } catch (err) {
    return { id: row.id, done, error: messageOf(err, fallback) }
  }
}

/** Rows with at least one changed cell. */
export const dirtyRows = (rows: GridRow[], base: Map<string, GridRow>) =>
  rows.filter((r) => EDITABLE_KEYS.some((k) => isDirty(r, base.get(r.id), k)))

/** Save each changed row (contact, then tags, then status), BATCH rows at a time. */
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
