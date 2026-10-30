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
import { formatCompact, formatPaise, formatPaiseCompact, formatPaiseWhole } from '@/lib/money'
import { DEFAULT_REGION, type Region, regionValue, weekStartsOn } from '@/lib/region'

/**
 * Money, numbers and dates for one admin language, as `useFormat()` hands them to components
 * (server code calls `formatters(await getLocale())`). Numbers keep Indian lakh/crore
 * grouping and Latin digits in both languages; Hindi only changes words and month names.
 * Times follow the member's region (12- or 24-hour, Account → Language & region).
 */
export type Formatters = {
  locale: Locale
  region: Region
  /** For a day picker's `weekStartsOn`: 0 Sunday, 1 Monday. */
  weekStartsOn: 0 | 1
  /** `en-IN` or `hi-IN`, for any `Intl` formatter a component still builds itself. */
  intl: string
  money: (paise: number) => string
  /** A total or average across orders, in whole units: ₹2,76,370 (never ₹2,76,370.18). */
  moneyWhole: (paise: number) => string
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

function build(locale: Locale, region: Region): Formatters {
  const { clock } = region
  return {
    locale,
    region,
    weekStartsOn: weekStartsOn(region),
    intl: INTL_LOCALE[locale],
    money: (paise) => formatPaise(paise, locale),
    moneyWhole: (paise) => formatPaiseWhole(paise, locale),
    moneyCompact: (paise) => formatPaiseCompact(paise, locale),
    number: (n) => formatNumber(n, { locale: INTL_LOCALE[locale] }),
    compact: (n) => formatCompact(n, locale),
    when: (value, now) => formatWhen(value, now, locale, clock),
    ago: (value, now) => formatAgo(value, now, locale),
    day: (value, now) => formatDay(value, now, locale),
    dateTime: (value) => formatDateTime(value, locale, clock),
    date: (value) => formatDate(value, locale),
    // A pattern with an hour follows the member's clock unless it names its own.
    pattern: (value, options) =>
      formatPattern(
        value,
        options.hour && options.hour12 === undefined && options.hourCycle === undefined
          ? { ...options, hour12: clock === '12h' }
          : options,
        locale,
      ),
  }
}

const cache = new Map<string, Formatters>()

/** The formatters for `locale` and `region`, built once per pair so references stay stable. */
export function formatters(locale: Locale, region: Region = DEFAULT_REGION): Formatters {
  const key = `${locale}:${regionValue(region)}`
  let f = cache.get(key)
  if (!f) {
    f = build(locale, region)
    cache.set(key, f)
  }
  return f
}
