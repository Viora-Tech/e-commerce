import { gstRegistration, media, order, refund, type StoreTx, store } from '@commerce/db'
import { invoiceBatch } from '@commerce/plugin-gst-invoices/server'
import { eq, inArray } from 'drizzle-orm'

/**
 * The GSTIN a GST invoices screen works on. A picked id is read back under RLS, so another
 * store's id is refused (null); undefined is the store's default GSTIN; `{ id: null }` is a
 * store without any GST registration.
 */
export async function registrationScope(
  tx: StoreTx,
  picked: string | null | undefined,
): Promise<{ id: string | null } | null> {
  if (picked === null) return { id: null }
  const [row] = await tx
    .select({ id: gstRegistration.id })
    .from(gstRegistration)
    .where(picked ? eq(gstRegistration.id, picked) : eq(gstRegistration.isDefault, true))
  if (picked) return row ? { id: row.id } : null
  return { id: row?.id ?? null }
}

/** Reads the GST invoices router needs beyond the plugin's own services. */
export async function storeName(tx: StoreTx, storeId: string): Promise<string> {
  const [s] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
  return s?.name ?? ''
}

/** Public URLs of library images, for the settings preview. */
export async function mediaUrls(tx: StoreTx, ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = ids.filter((x): x is string => Boolean(x))
  if (wanted.length === 0) return new Map()
  const rows = await tx
    .select({ id: media.id, url: media.url })
    .from(media)
    .where(inArray(media.id, wanted))
  return new Map(rows.map((m) => [m.id, m.url]))
}

export async function orderRefunds(tx: StoreTx, orderId: string) {
  const rows = await tx
    .select({
      id: refund.id,
      amountPaise: refund.amountPaise,
      status: refund.status,
      createdAt: refund.createdAt,
    })
    .from(refund)
    .where(eq(refund.orderId, orderId))
  return rows.filter((r) => r.status !== 'failed')
}

export async function createEmailBatch(tx: StoreTx, storeId: string, total: number) {
  const [batch] = await tx.insert(invoiceBatch).values({ storeId, total }).returning()
  if (!batch) throw new Error('batch insert returned nothing')
  return batch
}

export async function emailBatch(tx: StoreTx, id: string) {
  const [b] = await tx.select().from(invoiceBatch).where(eq(invoiceBatch.id, id))
  return b ?? null
}

/** Order ids for the order numbers a merchant typed, and the numbers that matched nothing. */
export async function orderIdsByNumber(tx: StoreTx, numbers: readonly number[]) {
  if (numbers.length === 0) return { ids: [] as string[], missing: [] as number[] }
  const rows = await tx
    .select({ id: order.id, number: order.number })
    .from(order)
    .where(inArray(order.number, [...numbers]))
  const found = new Set(rows.map((r) => r.number))
  return { ids: rows.map((r) => r.id), missing: numbers.filter((n) => !found.has(n)) }
}
