import type { DomainView, MarketView } from '@commerce/core'
import {
  currencyForCountry,
  marketPaths,
  pathClash,
  SUBFOLDER_PATTERN,
  suggestSubfolder,
} from '@commerce/core/markets'
import type { marketsContent } from '@/data/markets'

/** How shoppers reach a market: a subfolder of the main address, its own domain, or neither. */
export type MarketAccess = 'subfolder' | 'domain' | 'none'

/** The market dialog's fields, as typed. */
export type MarketForm = {
  name: string
  countries: string[]
  currency: string
  /** False until the merchant picks a currency: until then the first country's fills it in. */
  currencyPicked: boolean
  locale: string
  locales: string[]
  access: MarketAccess
  subfolder: string
  /** False until the merchant types a subfolder: until then the first country suggests one. */
  subfolderTyped: boolean
  domainId: string
  /** Percent, as typed ("10", "-5", "2.5"). */
  adjustment: string
  rounding: MarketView['rounding']
  /** Presentment units per rupee, as typed; empty uses the daily reference rate. */
  rate: string
  duties: MarketView['duties']
}

/** A connected domain the dialog offers, and the market that already opens on it. */
export type DomainOption = { id: string; hostname: string; usedBy: string | null }

export type FormProblems = Partial<
  Record<
    'name' | 'countries' | 'subfolder' | 'domain' | 'languages' | 'adjustment' | 'rate',
    string
  >
>

type DialogCopy = (typeof marketsContent)['dialog']

const PERCENT = /^-?\d{1,3}(\.\d{1,2})?$/
const RATE = /^\d{1,10}(\.\d{1,8})?$/

/** `0.04400000` (the database's scale) as `0.044`. */
function shortRate(rate: string): string {
  return rate.includes('.') ? rate.replace(/0+$/, '').replace(/\.$/, '') : rate
}

export function formOf(market: MarketView | null): MarketForm {
  if (!market) {
    return {
      name: '',
      countries: [],
      currency: 'USD',
      currencyPicked: false,
      locale: 'en',
      locales: [],
      access: 'subfolder',
      subfolder: '',
      subfolderTyped: false,
      domainId: '',
      adjustment: '0',
      rounding: 'none',
      rate: '',
      duties: 'dap',
    }
  }
  return {
    name: market.name,
    countries: market.countries,
    currency: market.currency,
    currencyPicked: true,
    locale: market.locale,
    locales: market.locales,
    access: market.subfolder ? 'subfolder' : market.storeDomainId ? 'domain' : 'none',
    subfolder: market.subfolder ?? '',
    subfolderTyped: true,
    domainId: market.storeDomainId ?? '',
    adjustment: String(market.priceAdjustmentBp / 100),
    rounding: market.rounding,
    rate: market.manualRate ? shortRate(market.manualRate) : '',
    duties: market.duties,
  }
}

/** Every address the other markets answer on, so a suggestion can avoid them. */
function takenPaths(others: readonly MarketView[]): string[] {
  return others.flatMap((m) => marketPaths(m))
}

/**
 * New countries; while the merchant has not chosen them, the currency and subfolder follow the
 * first country (`AE`: dirhams on `/ae`).
 */
export function withCountries(
  form: MarketForm,
  countries: string[],
  others: readonly MarketView[],
): MarketForm {
  const first = countries[0]
  if (!first) return { ...form, countries }
  return {
    ...form,
    countries,
    currency: form.currencyPicked ? form.currency : (currencyForCountry(first) ?? form.currency),
    subfolder: form.subfolderTyped
      ? form.subfolder
      : suggestSubfolder(first, form.locale, takenPaths(others)),
  }
}

/** The store's connected domains a market may open on: not the main one, not a redirect. */
export function domainOptions(
  domains: readonly DomainView[],
  others: readonly MarketView[],
): DomainOption[] {
  return domains
    .filter((d) => d.status === 'active' && !d.isPrimary && !d.redirectToPrimary)
    .map((d) => ({
      id: d.id,
      hostname: d.hostname,
      usedBy: others.find((m) => m.storeDomainId === d.id)?.name ?? null,
    }))
}

/**
 * What stops the form from saving, in the dialog's words; empty when it can save. A field still
 * empty only counts with `missing` (once the merchant tries to save); a clash or a bad number
 * counts while typing.
 */
export function formProblems(
  form: MarketForm,
  others: readonly MarketView[],
  isPrimary: boolean,
  copy: DialogCopy,
  missing: boolean,
): FormProblems {
  const problems: FormProblems = {}
  if (missing && !form.name.trim()) problems.name = copy.nameMissing
  const subfolder = form.access === 'subfolder' ? form.subfolder.trim() : ''
  const clash = pathClash(
    { isPrimary, subfolder: subfolder || null, locale: form.locale, locales: form.locales },
    others,
  )
  if (isPrimary) {
    if (clash) problems.languages = copy.language.taken(clash.path, clash.market.name)
    return problems
  }
  if (missing && form.countries.length === 0) problems.countries = copy.countries.missing
  if (form.access === 'subfolder' && (subfolder || missing) && !SUBFOLDER_PATTERN.test(subfolder)) {
    problems.subfolder = copy.reach.subfolderInvalid
  } else if (clash) {
    problems.subfolder = copy.reach.taken(clash.path, clash.market.name)
  }
  if (missing && form.access === 'domain' && !form.domainId) {
    problems.domain = copy.reach.domainMissing
  }
  const percent = Number(form.adjustment.trim() || '0')
  if (!PERCENT.test(form.adjustment.trim() || '0') || percent < -50 || percent > 200) {
    problems.adjustment = copy.pricing.adjustmentInvalid
  }
  const rate = form.rate.trim()
  if (rate && (!RATE.test(rate) || Number(rate) <= 0)) problems.rate = copy.pricing.rateInvalid
  return problems
}

/** The form as `markets.create` / `markets.update` take it. */
export function marketInput(form: MarketForm) {
  return {
    name: form.name.trim(),
    countries: form.countries,
    currency: form.currency,
    locale: form.locale,
    locales: form.locales,
    subfolder: form.access === 'subfolder' ? form.subfolder.trim().toLowerCase() : null,
    storeDomainId: form.access === 'domain' ? form.domainId : null,
    priceAdjustmentBp: Math.round(Number(form.adjustment.trim() || '0') * 100),
    rounding: form.rounding,
    manualRate: form.rate.trim() || null,
    duties: form.duties,
  }
}
