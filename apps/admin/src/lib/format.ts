import { formatNumber } from '@commerce/money'
import {
  formatAgo,
  formatDate,
  formatDateTime,
  formatDay,
  formatPattern,
  formatWhen,
} from '@/lib/format-date'
import { INTL_LOCALE, type Locale } from '@/lib/i18n'
import { formatCompact, formatPaise, formatPaiseCompact } from '@/lib/money'

/**
 * Money, numbers and dates for one admin language, as `useFormat()` hands them to components
 * (server code calls `formatters(await getLocale())`). Numbers keep Indian lakh/crore
 * grouping and Latin digits in both languages; Hindi only changes words and month names.
 */
export type Formatters = {
  locale: Locale
  /** `en-IN` or `hi-IN`, for any `Intl` formatter a component still builds itself. */
  intl: string
  money: (paise: number) => string
  moneyCompact: (paise: number) => string
  number: (n: number) => string
  compact: (n: number) => string
  when: (value: Date | string, now?: Date) => string
  ago: (value: Date | string, now?: Date) => string
  day: (value: Date | string, now?: Date) => string
  dateTime: (value: Date | string) => string
  date: (value: Date | string) => string
  /** Any other `Intl` date pattern, in the store's zone; never build a formatter in a component. */
  pattern: (value: Date | string | number, options: Intl.DateTimeFormatOptions) => string
}

function build(locale: Locale): Formatters {
  return {
    locale,
    intl: INTL_LOCALE[locale],
    money: (paise) => formatPaise(paise, locale),
    moneyCompact: (paise) => formatPaiseCompact(paise, locale),
    number: (n) => formatNumber(n, { locale: INTL_LOCALE[locale] }),
    compact: (n) => formatCompact(n, locale),
    when: (value, now) => formatWhen(value, now, locale),
    ago: (value, now) => formatAgo(value, now, locale),
    day: (value, now) => formatDay(value, now, locale),
    dateTime: (value) => formatDateTime(value, locale),
    date: (value) => formatDate(value, locale),
    pattern: (value, options) => formatPattern(value, options, locale),
  }
}

const byLocale = new Map<Locale, Formatters>()

/** The formatters for `locale`, built once per language so references stay stable. */
export function formatters(locale: Locale): Formatters {
  let f = byLocale.get(locale)
  if (!f) {
    f = build(locale)
    byLocale.set(locale, f)
  }
  return f
}
