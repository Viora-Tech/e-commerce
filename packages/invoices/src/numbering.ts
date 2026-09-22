/** IST is a fixed +05:30; Indian financial years run 1 April to 31 March in IST. */
const IST_OFFSET_MS = 330 * 60 * 1000

export type FinancialYear = {
  /** Calendar year the FY starts in: 2025 for 1 April 2025 to 31 March 2026. */
  startYear: number
  /** "25-26": what invoice numbers carry and what resets the sequence. */
  label: string
}

/** The financial year an instant falls in, judged on the Indian calendar date. */
export function financialYear(at: Date): FinancialYear {
  const ist = new Date(at.getTime() + IST_OFFSET_MS)
  const year = ist.getUTCFullYear()
  const startYear = ist.getUTCMonth() >= 3 ? year : year - 1
  const two = (y: number) => String(y % 100).padStart(2, '0')
  return { startYear, label: `${two(startYear)}-${two(startYear + 1)}` }
}

/**
 * Rule 46(b): a consecutive serial number of at most sixteen characters, using
 * letters, digits, hyphen and slash, unique for a financial year.
 */
export const DOCUMENT_NUMBER_MAX = 16
const ALLOWED = /^[A-Za-z0-9/-]+$/

export type NumberParts = {
  /** e.g. "WMR" or "WMR-CN". Letters, digits, hyphen, slash. */
  prefix: string
  fy: FinancialYear
  seq: number
  /** Minimum digits for the running number; it grows past this rather than wrapping. */
  pad: number
  /** `true` puts the FY label in the number: WMR/25-26/0001. */
  includeFy: boolean
}

/** "WMR/25-26/0001", or "WMR/0001" without the year. */
export function formatDocumentNumber(parts: NumberParts): string {
  const seq = String(parts.seq).padStart(parts.pad, '0')
  const prefix = parts.prefix.trim()
  const pieces = [prefix, parts.includeFy ? parts.fy.label : null, seq].filter((p): p is string =>
    Boolean(p),
  )
  return pieces.join('/')
}

export type NumberCheck = { ok: true } | { ok: false; reason: 'length' | 'characters' }

/** Whether a number is legal under rule 46(b). */
export function checkDocumentNumber(value: string): NumberCheck {
  if (!ALLOWED.test(value)) return { ok: false, reason: 'characters' }
  if (value.length > DOCUMENT_NUMBER_MAX) return { ok: false, reason: 'length' }
  return { ok: true }
}

/**
 * The longest number a format can produce within a year, so settings can refuse a
 * prefix that would overflow sixteen characters once the count reaches `pad` digits.
 */
export function widestDocumentNumber(parts: Omit<NumberParts, 'seq'>): string {
  return formatDocumentNumber({ ...parts, seq: 10 ** parts.pad - 1 })
}
