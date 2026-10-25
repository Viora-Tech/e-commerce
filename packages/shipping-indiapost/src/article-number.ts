/**
 * India Post article numbers (the "consignment number" on the counter receipt): the UPU S10
 * format, two letters, eight serial digits, one check digit and the country code, e.g.
 * EE123456785IN. Pure and browser-safe (`@commerce/shipping-indiapost/client` re-exports it), so
 * the admin can check the number as the merchant types it and the server checks it again.
 *
 * Check digit: weights 8 6 4 2 3 5 9 7 over the eight serial digits, 11 minus the sum mod 11,
 * with 10 → 0 and 11 → 5. Source: UPU standard S10 ("Identification of postal items: 13-character
 * identifier"), https://en.wikipedia.org/wiki/S10_(UPU_standard). The same rule backs
 * `s10CheckDigitValid` in `@commerce/core/tracking-numbers`; adapters stay free of core, so it is
 * repeated here with the parsing the booking needs.
 */

/** What the first letter says the article is. India Post: E… Speed Post, R… registered, C… parcel. */
export type ArticleKind = 'speed_post' | 'registered' | 'parcel' | 'other'

export type ArticleNumberResult =
  | { ok: true; number: string; kind: ArticleKind }
  | { ok: false; reason: 'empty' | 'format' | 'country' | 'check_digit' }

const WEIGHTS = [8, 6, 4, 2, 3, 5, 9, 7]

/** The check digit for eight serial digits. */
export function s10CheckDigit(serial: string): number {
  const sum = WEIGHTS.reduce((acc, w, i) => acc + w * Number(serial[i]), 0)
  const raw = 11 - (sum % 11)
  return raw === 10 ? 0 : raw === 11 ? 5 : raw
}

/** Spaces, dashes and dots people copy from receipts, gone; letters upper-cased. */
export function normaliseArticleNumber(raw: string): string {
  return raw.replace(/[\s.\-/]/g, '').toUpperCase()
}

function kindOf(n: string): ArticleKind {
  if (n.startsWith('E')) return 'speed_post'
  if (n.startsWith('R')) return 'registered'
  if (n.startsWith('C')) return 'parcel'
  return 'other'
}

/** Validate a typed article number. Only domestic India Post numbers (ending IN) are accepted. */
export function parseArticleNumber(raw: string | null | undefined): ArticleNumberResult {
  const n = normaliseArticleNumber(raw ?? '')
  if (!n) return { ok: false, reason: 'empty' }
  if (!/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(n)) return { ok: false, reason: 'format' }
  if (!n.endsWith('IN')) return { ok: false, reason: 'country' }
  if (s10CheckDigit(n.slice(2, 10)) !== Number(n[10])) return { ok: false, reason: 'check_digit' }
  return { ok: true, number: n, kind: kindOf(n) }
}

/** Merchant-facing wording for each reason; the admin has its own (translated) copy. */
export const ARTICLE_NUMBER_PROBLEMS: Record<
  Exclude<ArticleNumberResult, { ok: true }>['reason'],
  string
> = {
  empty: 'Enter the India Post article number from the counter receipt, like EE123456785IN.',
  format: 'An India Post article number is 2 letters, 9 digits and IN, like EE123456785IN.',
  country: 'That is not a domestic India Post number: it should end in IN.',
  check_digit:
    'That article number does not add up (its last digit is a check digit). Check it against the receipt.',
}
