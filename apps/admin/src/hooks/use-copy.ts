'use client'

import { createContext, useContext } from 'react'
import { localize } from '@/lib/copy'
import { type Formatters, formatters } from '@/lib/format'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n'
import { DEFAULT_REGION, type Region } from '@/lib/region'

/** Set once by `LocaleProvider` in the root layout from the `admin_locale` cookie. */
export const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

/** Set by `LocaleProvider` from the `admin_region` cookie: 12/24-hour times and week start. */
export const RegionContext = createContext<Region>(DEFAULT_REGION)

/** The member's admin language. */
export function useLocale(): Locale {
  return useContext(LocaleContext)
}

/**
 * `en` (an export of `data/<feature>.ts`) in the member's language: its Hindi overlay when
 * `data/hi/index.ts` registers one, English otherwise, key by key.
 *
 * ```tsx
 * const copy = useCopy(ordersContent)
 * ```
 */
export function useCopy<T>(en: T): T {
  return localize(en, useLocale())
}

/** The member's date-and-time preferences (Account → Language & region). */
export function useRegion(): Region {
  return useContext(RegionContext)
}

/** Money, numbers and dates in the member's language and time format (Indian grouping in both). */
export function useFormat(): Formatters {
  return formatters(useLocale(), useRegion())
}
