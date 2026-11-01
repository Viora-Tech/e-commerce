/** SOURCE OF TRUTH: manual payment method rows — WHAT the "UPI ID" and "Bank transfer" rows under Manual payment methods switch and say / WHY both rows share the one `manual` provider, so orders, reminders and expiry keep working unchanged (audit #149) */
import { z } from 'zod'

/*
 * Pure (no database), so the admin can import it through `@commerce/core/manual-rows`
 * without pulling the server barrel.
 *
 * Both rows are the built-in `manual` provider: the shopper pays the store
 * directly and the order waits as pending payment until a staff member marks
 * it paid. Each row has its own on/off and its own instructions for the
 * shopper. Stores saved before the rows existed have both rows on, so they
 * behave exactly as before.
 */

export const MANUAL_ROW_IDS = ['upi', 'bank'] as const
export type ManualRowId = (typeof MANUAL_ROW_IDS)[number]

export const ManualRowSchema = z.object({
  on: z.boolean(),
  /** Shown to the shopper with the payment details (checkout, thank-you page, email). */
  note: z.string().max(500).optional(),
})
export type ManualRow = z.infer<typeof ManualRowSchema>

export const ManualRowsSchema = z.object({
  upi: ManualRowSchema.optional(),
  bank: ManualRowSchema.optional(),
})
export type ManualRows = z.infer<typeof ManualRowsSchema>

type ManualConfig = Record<string, string | undefined>

/** The details a row needs before it can be switched on. */
export function manualRowReady(id: ManualRowId, cfg: ManualConfig | undefined): boolean {
  const has = (k: string) => Boolean(cfg?.[k]?.trim())
  return id === 'upi'
    ? has('upiId') && has('payeeName')
    : has('bankName') && has('accountName') && has('accountNumber') && has('ifsc')
}

/** A row's switch; a row never saved is on (the store's state before the rows existed). */
export const manualRowOn = (rows: ManualRows | undefined, id: ManualRowId): boolean =>
  rows?.[id]?.on ?? true

const UPI_KEYS = ['upiId', 'payeeName'] as const
const BANK_KEYS = ['bankName', 'accountName', 'accountNumber', 'ifsc'] as const

/**
 * The `manual` provider's config as checkout uses it: a row that is off has
 * its details left out (so the shopper never sees them), and each row's own
 * instructions are added to the shared note.
 */
export function manualConfigForCheckout(
  cfg: Record<string, string>,
  rows: ManualRows | undefined,
): Record<string, string> {
  const out = { ...cfg }
  const notes: string[] = []
  if (cfg.note?.trim()) notes.push(cfg.note.trim())
  for (const id of MANUAL_ROW_IDS) {
    if (!manualRowOn(rows, id)) {
      for (const k of id === 'upi' ? UPI_KEYS : BANK_KEYS) delete out[k]
      continue
    }
    const note = rows?.[id]?.note?.trim()
    if (note && manualRowReady(id, cfg)) notes.push(note)
  }
  if (notes.length) out.note = notes.join('\n')
  else delete out.note
  return out
}

/** True when at least one row is on and has its details: the `manual` provider belongs at checkout. */
export function anyManualRowLive(cfg: ManualConfig | undefined, rows: ManualRows | undefined) {
  return MANUAL_ROW_IDS.some((id) => manualRowOn(rows, id) && manualRowReady(id, cfg))
}
