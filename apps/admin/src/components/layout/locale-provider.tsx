'use client'

import type { ReactNode } from 'react'
import { LocaleContext, RegionContext } from '@/hooks/use-copy'
import type { Locale } from '@/lib/i18n'
import type { Region } from '@/lib/region'

type LocaleProviderProps = {
  locale: Locale
  region: Region
  children: ReactNode
}

/**
 * Hands the cookies' language and region (time format, week start), read by the root layout
 * on the server, to client components.
 */
export default function LocaleProvider({ locale, region, children }: LocaleProviderProps) {
  return (
    <LocaleContext value={locale}>
      <RegionContext value={region}>{children}</RegionContext>
    </LocaleContext>
  )
}
