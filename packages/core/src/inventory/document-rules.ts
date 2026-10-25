/** SOURCE OF TRUTH: purchase document kinds, statuses, upload limits, kind → AI shape, the
 * charge each bill becomes, and printed amounts as minor units — WHAT: the pure rules the
 * upload check, the AI reader, the review screen and Apply share. WHY: "what may be
 * uploaded" and "which charge a CHA bill makes" have one answer in the browser and on the
 * server. No database; client components import it through `@commerce/core/inventory`.
 */
import { currencyDigits, PURCHASE_CURRENCY_CODES, type PurchaseChargeKind } from './landed-cost'

/** Same values as `purchase_document.kind` (packages/db purchasing-schema). */
export const PURCHASE_DOCUMENT_KINDS = [
  'supplier_invoice',
  'bill_of_entry',
  'freight_bill',
  'cha_bill',
  'bank_advice',
  'other',
] as const
export type PurchaseDocumentKind = (typeof PURCHASE_DOCUMENT_KINDS)[number]

/** Same values as `purchase_document.status`: pending → reading → ready | failed → applied. */
const PURCHASE_DOCUMENT_STATUSES = ['pending', 'reading', 'ready', 'failed', 'applied'] as const
export type PurchaseDocumentStatus = (typeof PURCHASE_DOCUMENT_STATUSES)[number]

/**
 * Why a read failed, stored on the row as a code; the admin shows its own words for each
 * (English and Hindi).
 */
const DOCUMENT_READ_ERRORS = [
  'ai_off',
  'feature_off',
  'quota',
  'file_missing',
  'unreadable',
  'model_failed',
] as const
export type DocumentReadError = (typeof DOCUMENT_READ_ERRORS)[number]

/** 15 MB: a scanned multi-page Bill of Entry fits; a stray video does not. */
export const PURCHASE_DOCUMENT_MAX_BYTES = 15 * 1024 * 1024

/** PDF, JPG and PNG, with the extension each is stored under. */
export const PURCHASE_DOCUMENT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

export const isPurchaseDocumentType = (mime: string): boolean =>
  Object.hasOwn(PURCHASE_DOCUMENT_TYPES, mime.toLowerCase())

/** Which of the AI's three shapes reads a kind: every bill that is not goods or customs is a service bill. */
export function shapeForKind(
  kind: PurchaseDocumentKind,
): 'supplier_invoice' | 'bill_of_entry' | 'service_bill' {
  if (kind === 'supplier_invoice' || kind === 'bill_of_entry') return kind
  return 'service_bill'
}

/** The charge a service bill becomes by default; the review can change it. */
export const CHARGE_KIND_FOR_BILL: Record<PurchaseDocumentKind, PurchaseChargeKind> = {
  supplier_invoice: 'freight_insurance',
  bill_of_entry: 'customs_bcd',
  freight_bill: 'freight_insurance',
  cha_bill: 'cha_fee',
  bank_advice: 'bank_fx',
  other: 'other',
}

/** The currency code when we can price purchases in it, else null. */
export function purchaseCurrencyOf(code: string | null | undefined): string | null {
  const c = (code ?? '').trim().toUpperCase()
  return (PURCHASE_CURRENCY_CODES as string[]).includes(c) ? c : null
}

/**
 * A printed amount (12.4, 18500.5) as minor units of `currency`, rounded half away from zero
 * at the currency's digits. Through a fixed-point string, never `amount * 100`, so 0.29
 * stays 29 cents. Null for null, NaN or infinity.
 */
export function printedToMinor(amount: number | null | undefined, currency: string): number | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return null
  const digits = currencyDigits(currency)
  const [whole = '0', frac = ''] = Math.abs(amount)
    .toFixed(digits + 1)
    .split('.')
  const kept = BigInt(whole + frac.slice(0, digits))
  const roundUp = Number(frac.slice(digits, digits + 1)) >= 5 ? 1n : 0n
  const minor = Number(kept + roundUp)
  return amount < 0 ? -minor : minor
}

/** An exchange rate as printed (83.25) as the six-decimal text `fx_rate` stores; null if not positive. */
export function printedRate(rate: number | null | undefined): string | null {
  if (rate === null || rate === undefined || !Number.isFinite(rate) || rate <= 0) return null
  return rate.toFixed(6).replace(/\.?0+$/, '')
}
