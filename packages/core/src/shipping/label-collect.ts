/** SOURCE OF TRUTH: collectLabelFiles, LabelSheetSkip
 * WHAT:  gathers a batch's label files in the order asked, a few at a time, and names the ones
 *        that cannot be printed (another store's id, cancelled, not sent yet, fetch failed).
 * WHY:   the one-file label print must say which labels it left out, not fail the batch.
 * WHERE: `printLabelSheet` (packages/api label-sheet.service.ts) passes the store's rows and
 *        a reader; `mergeLabelSheet` (label-sheet.ts) draws what comes back.
 */
import type { LabelFile } from './label-sheet'

/** Labels fetched at once: gentle on courier APIs, still quick for a batch. */
const CONCURRENCY = 4

export type LabelSheetSkipReason =
  /** Not a shipment of this store. */
  | 'not_found'
  | 'cancelled'
  /** The courier has not sent a label yet. */
  | 'no_label'
  /** The courier did not hand it over just now. */
  | 'failed'
  /** The file was not a PDF or an image. */
  | 'unreadable'

export type LabelSheetSkip = {
  shipmentId: string
  orderNumber: number | null
  reason: LabelSheetSkipReason
}

export type LabelRow = {
  id: string
  orderNumber: number | null
  status: string
  provider: string
  waybill: string
  labelUrl: string | null
}

/**
 * Every requested label's bytes, in the order asked, and the ones skipped with why. `rows` are
 * the caller's store's shipments only, so an id it does not hold is `not_found`. `read` gives a
 * label's bytes, null when the courier has none yet, and throws when it could not be fetched.
 */
export async function collectLabelFiles(
  ids: string[],
  rows: LabelRow[],
  read: (row: LabelRow) => Promise<Uint8Array | null>,
): Promise<{ files: LabelFile[]; skipped: LabelSheetSkip[] }> {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const unique = [...new Set(ids)]
  const results: ({ file: LabelFile } | { skip: LabelSheetSkip })[] = new Array(unique.length)
  let next = 0
  const worker = async () => {
    for (;;) {
      const i = next++
      if (i >= unique.length) return
      const id = unique[i] as string
      const row = byId.get(id)
      if (!row) {
        results[i] = { skip: { shipmentId: id, orderNumber: null, reason: 'not_found' } }
        continue
      }
      const skip = (reason: LabelSheetSkipReason) => ({
        skip: { shipmentId: id, orderNumber: row.orderNumber, reason },
      })
      if (row.status === 'cancelled') {
        results[i] = skip('cancelled')
        continue
      }
      if (!row.labelUrl) {
        results[i] = skip('no_label')
        continue
      }
      try {
        const bytes = await read(row)
        results[i] = bytes && bytes.byteLength > 0 ? { file: { id, bytes } } : skip('no_label')
      } catch {
        results[i] = skip('failed')
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, unique.length) }, worker))
  const files: LabelFile[] = []
  const skipped: LabelSheetSkip[] = []
  for (const r of results) {
    if ('file' in r) files.push(r.file)
    else skipped.push(r.skip)
  }
  return { files, skipped }
}
