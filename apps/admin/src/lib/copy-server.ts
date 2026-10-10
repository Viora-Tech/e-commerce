import 'server-only'
import { cookies } from 'next/headers'
import { localize } from '@/lib/copy'
import { LOCALE_COOKIE, type Locale, parseLocale } from '@/lib/i18n'
import { parseRegion, REGION_COOKIE, type Region } from '@/lib/region'

/** The member's admin language from the `admin_locale` cookie; English when unset. */
export async function getLocale(): Promise<Locale> {
  const jar = await cookies()
  return parseLocale(jar.get(LOCALE_COOKIE)?.value)
}

/** The member's time format and week start from the `admin_region` cookie; defaults when unset. */
export async function getRegion(): Promise<Region> {
  const jar = await cookies()
  return parseRegion(jar.get(REGION_COOKIE)?.value)
}

/** `useCopy` for server components and `generateMetadata`: `en` in the member's language. */
export async function getCopy<T>(en: T): Promise<T> {
  return localize(en, await getLocale())
}
