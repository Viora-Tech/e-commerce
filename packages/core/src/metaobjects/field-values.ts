/** SOURCE OF TRUTH: content field value shapes (CMS PR2) — WHAT the stored shape and the check for colour, date and time, money, choice, link, rating and measurement values, plus their plain-text form / WHY the admin (inline errors), the server (the check that counts), the storefront and an importer mapping Shopify metafields must agree on one shape per type. Browser-safe, no database. */
import { type Currency, formatMoney } from '@commerce/money'
import {
  DEFAULT_RATING_MAX,
  FIELD_CURRENCIES,
  type FieldValidations,
  MEASURE_UNITS,
  type MeasureUnit,
} from './schemas'

/*
 * Shopify metafield types map onto these as: color → color, date_time → date_time,
 * money {amount: "5.99", currency_code} → money {amount: 599, currency}, list.* of a choice
 * text → choice list, link {text, url} → link {label, url}, rating {value, scale_max} →
 * rating {value, max}, weight / dimension / volume {value, unit} → measurement with
 * `measure` weight / length / volume, page_reference / variant_reference →
 * page_reference / variant_reference, and an article reference → article_reference.
 */

export type MoneyValue = { amount: number; currency: Currency }
export type LinkValue = { label: string; url: string }
export type RatingValue = { value: number; max: number }
export type MeasurementValue = { value: number; unit: MeasureUnit }

export type ItemResult = { ok: true; value: unknown } | { ok: false; error: string }

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/
const LINK_LABEL_MAX = 200
const URL_MAX = 2_048

const fail = (error: string): ItemResult => ({ ok: false, error })

const record = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null

function number(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v.trim())
  return null
}

/** `#ABC` → `#aabbcc`; null when it is not a hex colour. */
export function normaliseHex(v: unknown): string | null {
  if (typeof v !== 'string' || !HEX.test(v.trim())) return null
  const hex = v.trim().slice(1).toLowerCase()
  return `#${
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex
  }`
}

/** A web link (http/https) or a path on this store (`/pages/about`). */
function isLinkTarget(s: string): boolean {
  if (s.length > URL_MAX) return false
  if (/^\/(?![/\\])/.test(s)) return true
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export const ratingMaxOf = (rules: FieldValidations | undefined): number =>
  rules?.ratingMax ?? DEFAULT_RATING_MAX

export const currencyOf = (rules: FieldValidations | undefined): Currency =>
  rules?.currency ?? 'INR'

/** One non-empty value of a CMS PR2 type: its stored form, or why it is wrong. */
export function validateRichItem(
  type: 'color' | 'date_time' | 'money' | 'choice' | 'link' | 'rating' | 'measurement',
  v: unknown,
  rules: FieldValidations | undefined,
): ItemResult {
  switch (type) {
    case 'color': {
      const hex = normaliseHex(v)
      return hex ? { ok: true, value: hex } : fail('needs a colour, like #1a2b3c')
    }
    case 'date_time': {
      const at = typeof v === 'string' && ISO_INSTANT.test(v.trim()) ? new Date(v.trim()) : null
      if (!at || Number.isNaN(at.getTime())) return fail('needs a date and a time')
      return { ok: true, value: at.toISOString() }
    }
    case 'money': {
      const currency = currencyOf(rules)
      const r = record(v)
      const amount = number(r ? r.amount : v)
      if (amount === null || !Number.isSafeInteger(amount) || amount < 0) {
        return fail('needs an amount, like 499')
      }
      if (r && r.currency !== undefined && r.currency !== currency) {
        return fail(`must be in ${currency}`)
      }
      return { ok: true, value: { amount, currency } satisfies MoneyValue }
    }
    case 'choice': {
      if (typeof v !== 'string') return fail('must be picked from the choices')
      const s = v.trim()
      if (!rules?.choices?.includes(s)) return fail('must be picked from the choices')
      return { ok: true, value: s }
    }
    case 'link': {
      const r = record(v)
      const url = typeof r?.url === 'string' ? r.url.trim() : ''
      const label = typeof r?.label === 'string' ? r.label.trim() : ''
      if (!url) return fail('needs a link')
      if (!isLinkTarget(url)) {
        return fail('must be a full link, like https://example.com, or a page like /pages/about')
      }
      if (label.length > LINK_LABEL_MAX || /[\r\n]/.test(label)) {
        return fail(`text must be one line of ${LINK_LABEL_MAX} characters or fewer`)
      }
      return { ok: true, value: { label, url } satisfies LinkValue }
    }
    case 'rating': {
      const max = ratingMaxOf(rules)
      const r = record(v)
      const value = number(r ? r.value : v)
      if (value === null || value < 0 || value > max) return fail(`needs 0 to ${max} stars`)
      if (Math.round(value * 2) !== value * 2) return fail('can only use whole or half stars')
      return { ok: true, value: { value, max } satisfies RatingValue }
    }
    case 'measurement': {
      const units: readonly string[] = rules?.measure ? MEASURE_UNITS[rules.measure] : []
      const r = record(v)
      const value = number(r?.value)
      if (value === null || value < 0) return fail('needs a number, like 1.5')
      const unit = typeof r?.unit === 'string' ? r.unit : ''
      if (!units.includes(unit)) return fail(`needs a unit: ${units.join(', ')}`)
      return { ok: true, value: { value, unit: unit as MeasureUnit } satisfies MeasurementValue }
    }
  }
}

/** Is the type one `validateRichItem` checks? */
export const isRichType = (type: string): type is Parameters<typeof validateRichItem>[0] =>
  ['color', 'date_time', 'money', 'choice', 'link', 'rating', 'measurement'].includes(type)

// Plain text, for storefront text settings and admin summaries. English units and figures;
// the storefront's own copy says the words around them.

const UNIT_TEXT: Partial<Record<MeasureUnit, string>> = { fl_oz: 'fl oz' }

const unitText = (unit: MeasureUnit): string => UNIT_TEXT[unit] ?? unit

/** `{ value: 1.5, unit: 'kg' }` → `1.5 kg`. */
export function measurementText(v: unknown): string | null {
  const r = record(v)
  if (typeof r?.value !== 'number' || typeof r.unit !== 'string') return null
  return `${r.value} ${unitText(r.unit as MeasureUnit)}`
}

/** `{ value: 4.5, max: 5 }` → `4.5/5`. */
export function ratingText(v: unknown): string | null {
  const r = record(v)
  if (typeof r?.value !== 'number' || typeof r.max !== 'number') return null
  return `${r.value}/${r.max}`
}

/** A money value as `₹499`; a bare number (product prices) is paise in rupees. */
export function moneyText(v: unknown): string | null {
  if (typeof v === 'number') return formatMoney(v, 'INR')
  const r = record(v)
  if (typeof r?.amount !== 'number') return null
  const currency = (FIELD_CURRENCIES as readonly unknown[]).includes(r.currency)
    ? (r.currency as Currency)
    : 'INR'
  return formatMoney(r.amount, currency)
}
