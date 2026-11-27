/** SOURCE OF TRUTH: collectLabelFiles, LabelSheetSkip
 * WHAT:  gathers a batch's label files in the order asked, a few at a time, and names the ones
 *        that cannot be printed (another store's id, cancelled, not sent yet, fetch failed).
 * WHY:   the one-file label print must say which labels it left out, not fail the batch.
 * WHERE: `printLabelSheet` (packages/api label-sheet.service.ts) passes the store's rows and
 *        a reader; `mergeLabelSheet` (label-sheet.ts) draws what comes back.
 */
import { CourierError, describeCourierFailureForStaff } from '@commerce/shipping'
import type { LabelFile } from './label-sheet'

/** Labels fetched at once: gentle on courier APIs, still quick for a batch. */
const CONCURRENCY = 4
/** Wait before the one retry of a label the courier could not hand over just now. */
export const LABEL_RETRY_DELAY_MS = 1500

/** The courier's "no label for it yet" in its own words (Delhivery's packing slip). */
const NOT_READY = /\bno label\b|label (?:is )?not (?:yet )?(?:ready|generated|available)/i

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
  /** The courier's name ("Delhivery"), when the shipment was found. */
  courier?: string | undefined
  /** What the courier said, for staff and the server log (no URLs, no customer data). */
  detail?: string | undefined
}

export type LabelRow = {
  id: string
  orderNumber: number | null
  status: string
  provider: string
  waybill: string
  labelUrl: string | null
  /** The courier's name for the skip list; the provider id when absent. */
  courier?: string | undefined
}

/** A courier refusal that says the label is not made yet. */
function notReady(error: unknown): boolean {
  if (error instanceof CourierError && error.detail?.code === 'label_not_ready') return true
  return error instanceof Error && NOT_READY.test(error.message)
}

/** Worth one more try in a moment: a slow, busy or rate-limited courier, or a label not made yet. */
function retryable(error: unknown): boolean {
  if (notReady(error)) return true
  return (
    error instanceof CourierError &&
    (error.kind === 'timeout' || error.kind === 'unavailable' || error.kind === 'rate_limited')
  )
}

/** The courier's words for a failed label, as staff read them. */
function failureText(error: unknown): string {
  if (error instanceof CourierError) return describeCourierFailureForStaff(error)
  return error instanceof Error ? error.message : String(error)
}

/**
 * Every requested label's bytes, in the order asked, and the ones skipped with why. `rows` are
 * the caller's store's shipments only, so an id it does not hold is `not_found`. `read` gives a
 * label's bytes, null when the courier has none yet, and throws when it could not be fetched.
 * A timeout, an unavailable or rate-limited courier, or a label not made yet is asked once more
 * after `retryDelayMs`; a skip keeps the courier's words as `detail`.
 */
export async function collectLabelFiles(
  ids: string[],
  rows: LabelRow[],
  read: (row: LabelRow) => Promise<Uint8Array | null>,
  opts: { retryDelayMs?: number | undefined } = {},
): Promise<{ files: LabelFile[]; skipped: LabelSheetSkip[] }> {
  const retryDelayMs = opts.retryDelayMs ?? LABEL_RETRY_DELAY_MS
  const readWithRetry = async (row: LabelRow) => {
    try {
      return await read(row)
    } catch (error) {
      if (!retryable(error)) throw error
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
      return read(row)
    }
  }
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
      const skip = (reason: LabelSheetSkipReason, detail?: string) => ({
        skip: {
          shipmentId: id,
          orderNumber: row.orderNumber,
          reason,
          courier: row.courier ?? row.provider,
          ...(detail ? { detail } : {}),
        },
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
        const bytes = await readWithRetry(row)
        results[i] = bytes && bytes.byteLength > 0 ? { file: { id, bytes } } : skip('no_label')
      } catch (error) {
        results[i] = skip(notReady(error) ? 'no_label' : 'failed', failureText(error))
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
