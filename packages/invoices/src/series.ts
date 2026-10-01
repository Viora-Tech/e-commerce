import { z } from 'zod'
import { checkDocumentNumber, type FinancialYear, financialYear } from './numbering'

/**
 * Numbering series. Every numbered document takes its number from exactly one
 * series, picked at issue by the document kind and the series rule. Each
 * series keeps its own counter per financial year, so each is gapless on its
 * own and restarts at 1 on 1 April (IST). Rule 46(b): at most 16 characters,
 * letters, digits, hyphen and slash, unique within the financial year.
 */

export const SERIES_KINDS = [
  'tax_invoice',
  'credit_note',
  'receipt_voucher',
  'refund_voucher',
] as const
export type SeriesKind = (typeof SERIES_KINDS)[number]

/**
 * Which documents a series takes. `export`: goods shipped outside India
 * (zero-rated, IGST Act s.16). `b2b`: a domestic buyer with a GSTIN.
 * `domestic`: everything else shipped within India.
 */
export const SERIES_RULES = ['export', 'b2b', 'domestic'] as const
export type SeriesRule = (typeof SERIES_RULES)[number]

const PLAIN = /^[A-Za-z0-9/-]*$/

/** Letters, digits, / and -, with `{FY}` and `{GST}` each at most once. */
function patternOk(v: string): boolean {
  const tokens = v.match(/\{[^}]*\}/g) ?? []
  if (tokens.some((t) => t !== '{FY}' && t !== '{GST}')) return false
  if (tokens.length !== new Set(tokens).size) return false
  return PLAIN.test(v.replaceAll('{FY}', '').replaceAll('{GST}', ''))
}

/**
 * The longest text `{GST}` can print: a registration's invoice prefix is at most 5
 * characters (`gst_registration_invoice_prefix_check`), and the fallback state letters 2.
 */
const GST_TOKEN_WIDEST = 'XXXXX'

export const SeriesSchema = z.object({
  /** Stable id stored on the counter and on every document; never reuse one. */
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,24}$/, 'Use lowercase letters, digits and dashes'),
  name: z.string().trim().min(1).max(40),
  kind: z.enum(SERIES_KINDS),
  rule: z.enum(SERIES_RULES),
  /**
   * Text before the running number; `{FY}` becomes `26-27` and `{GST}` the issuing GST
   * number's invoice prefix (Settings › Business and GST), or its state letters, e.g. `HR`.
   * E.g. `INV/{FY}/` or `{GST}/{FY}/`.
   */
  pattern: z
    .string()
    .trim()
    .toUpperCase()
    .refine(patternOk, 'Use letters, digits, / and - with an optional {FY} and {GST}'),
  /** Minimum digits of the running number: 4 gives 0001. It grows past this rather than wrapping. */
  pad: z.coerce.number().int().min(1).max(8).default(4),
  /**
   * Start again at 1 every 1 April: true or absent (what older rows mean).
   * Off: one running count that carries on across years. Either way numbers
   * stay unique within a financial year, as rule 46(b) asks.
   */
  resetEachYear: z.boolean().optional(),
})
export type Series = z.infer<typeof SeriesSchema>

const s = (
  id: string,
  name: string,
  kind: SeriesKind,
  rule: SeriesRule,
  pattern: string,
): Series => ({
  id,
  name,
  kind,
  rule,
  pattern,
  pad: 4,
})

/** Domestic and export series for every numbered kind, in priority order. */
export const DEFAULT_SERIES: Series[] = [
  s('inv', 'Tax invoices', 'tax_invoice', 'domestic', 'INV/{FY}/'),
  s('exp', 'Export invoices', 'tax_invoice', 'export', 'EXP/{FY}/'),
  s('cn', 'Credit notes', 'credit_note', 'domestic', 'CN/{FY}/'),
  s('ecn', 'Export credit notes', 'credit_note', 'export', 'ECN/{FY}/'),
  s('rv', 'Receipt vouchers', 'receipt_voucher', 'domestic', 'RV/{FY}/'),
  s('erv', 'Export receipt vouchers', 'receipt_voucher', 'export', 'ERV/{FY}/'),
  s('rfv', 'Refund vouchers', 'refund_voucher', 'domestic', 'RFV/{FY}/'),
  s('erfv', 'Export refund vouchers', 'refund_voucher', 'export', 'ERF/{FY}/'),
]

/**
 * A document number from its series. `gst` is what `{GST}` prints for the issuing
 * registration (see `gstToken` in the GST invoices app); a pattern without `{GST}` ignores
 * it, and a blank one leaves no doubled `/` or `-` behind.
 */
export function formatSeriesNumber(
  series: Pick<Series, 'pattern' | 'pad'>,
  fy: FinancialYear,
  seq: number,
  gst = '',
) {
  const withYear = series.pattern.replace('{FY}', fy.label)
  // A blank `{GST}` takes one neighbouring separator with it: `{GST}/INV/` prints `INV/`.
  const prefix = gst
    ? withYear.replace('{GST}', gst)
    : withYear.replace(/\{GST\}[/-]?|[/-]\{GST\}$/, '')
  return `${prefix}${String(seq).padStart(series.pad, '0')}`
}

/** The longest number the series can print before its digits outgrow `pad`. */
export function widestSeriesNumber(series: Pick<Series, 'pattern' | 'pad'>, at = new Date()) {
  return formatSeriesNumber(series, financialYear(at), 10 ** series.pad - 1, GST_TOKEN_WIDEST)
}

/**
 * The year a series' counter row is keyed by: the financial year when it
 * resets every April, else 0, one counter for good.
 */
export function counterYear(series: Pick<Series, 'resetEachYear'>, fy: FinancialYear): number {
  return series.resetEachYear === false ? 0 : fy.startYear
}

/**
 * Why a merchant cannot set the next number to `wanted`, or null. Going back
 * would hand out a number already used, so only the current next number or a
 * higher one is allowed.
 */
export function nextNumberProblem(current: number, wanted: number): string | null {
  if (!Number.isInteger(wanted) || wanted < 1) return 'Use a whole number, 1 or more'
  if (wanted > 99_999_999) return 'That number is too big'
  if (wanted < current)
    return `Numbers up to ${current - 1} are already used; pick ${current} or more`
  return null
}

/** Why a series is not usable, or null. */
export function seriesProblem(series: Series): string | null {
  const widest = widestSeriesNumber(series)
  if (!checkDocumentNumber(widest).ok) {
    return `Numbers would reach ${widest.length} characters (${widest}); GST allows 16`
  }
  return null
}

export type SeriesContext = { export: boolean; b2b: boolean }

/**
 * The series a document is numbered from: the first series of its kind whose
 * rule matches, in the order the merchant listed them. Exports only ever
 * match an export series; `b2b` matches domestic buyers with a GSTIN; a
 * domestic series takes the rest.
 */
export function pickSeries(
  series: readonly Series[],
  kind: SeriesKind,
  ctx: SeriesContext,
): Series | null {
  return (
    series.find((x) => {
      if (x.kind !== kind) return false
      if (x.rule === 'export') return ctx.export
      if (ctx.export) return false
      if (x.rule === 'b2b') return ctx.b2b
      return true
    }) ?? null
  )
}
