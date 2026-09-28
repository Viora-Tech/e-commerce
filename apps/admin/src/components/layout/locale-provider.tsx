'use client'

import type { ReactNode } from 'react'
import { LocaleContext } from '@/hooks/use-copy'
import type { Locale } from '@/lib/i18n'

type LocaleProviderProps = {
  locale: Locale
  children: ReactNode
}

/** Hands the cookie's language, read by the root layout on the server, to client components. */
export default function LocaleProvider({ locale, children }: LocaleProviderProps) {
  return <LocaleContext value={locale}>{children}</LocaleContext>
}
