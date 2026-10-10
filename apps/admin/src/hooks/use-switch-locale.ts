'use client'

import { useRouter } from 'next/navigation'
import { type Locale, localeCookie } from '@/lib/i18n'

/**
 * Switches the admin language: writes the `admin_locale` cookie and asks the server to render
 * again, so the root layout reads the new language and every page switches over.
 */
export function useSwitchLocale(): (locale: Locale) => void {
  const router = useRouter()

  return (locale) => {
    // biome-ignore lint/suspicious/noDocumentCookie: a plain first-party preference cookie.
    document.cookie = localeCookie(locale)
    router.refresh()
  }
}
