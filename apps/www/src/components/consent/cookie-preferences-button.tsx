'use client'

import { siteContent } from '@/data/site'
import { useConsentPreferences } from './consent-context'

export default function CookiePreferencesButton() {
  // Hooks
  const { openPreferences } = useConsentPreferences()

  return (
    <button
      type="button"
      onClick={openPreferences}
      className="transition-colors hover:text-foreground"
    >
      {siteContent.cookiePreferences}
    </button>
  )
}
