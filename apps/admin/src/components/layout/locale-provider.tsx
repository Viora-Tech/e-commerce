'use client'

import { type ReactNode, use } from 'react'
import { LocaleContext, RegionContext } from '@/hooks/use-copy'
import { hindiLoaded, loadHindi } from '@/lib/hindi'
import type { Locale } from '@/lib/i18n'
import type { Region } from '@/lib/region'

type LocaleProviderProps = {
  locale: Locale
  region: Region
  children: ReactNode
}

/**
 * Hands the cookies' language and region (time format, week start), read by the root layout
 * on the server, to client components. For Hindi it first waits for the overlays' chunk
 * (`lib/hindi.ts`), so nothing below renders English; English members never fetch it.
 */
export default function LocaleProvider({ locale, region, children }: LocaleProviderProps) {
  // Hooks
  if (locale === 'hi' && !hindiLoaded()) use(loadHindi())

  return (
    <LocaleContext value={locale}>
      <RegionContext value={region}>{children}</RegionContext>
    </LocaleContext>
  )
}
