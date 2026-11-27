import { financialYear } from '@commerce/invoices'

/** "2026-27": the financial year invoices are numbered in at `at` (Indian FY, April to March). */
export function numberingYear(at: Date): string {
  const fy = financialYear(at)
  return `${fy.startYear}-${fy.label.slice(3)}`
}

/**
 * The GSTIN the Queue's meta line shows: the app's seller GSTIN, else the store's own one, as
 * the app bar's pill read it (`queueBarRead`). `null` ("No GSTIN yet") only when both are blank.
 */
export function headerGstin(
  seller: string | null | undefined,
  store: string | null | undefined,
): string | null {
  return seller?.trim() || store?.trim() || null
}
