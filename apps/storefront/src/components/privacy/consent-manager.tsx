'use client'

import { type CookieBannerSettings, ZeroDriftCookieBanner } from '@commerce/blocks'
import {
  allowedTags,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  type Consent,
  type ConsentPreferences,
  currentConsent,
  encodeConsent,
  type StoredConsent,
} from '@commerce/core/consent'
import { useEffect, useState } from 'react'
import TrackingTags from '@/components/analytics/tracking-tags'
import VisitBeacon from '@/components/analytics/visit-beacon'
import CookieBanner from '@/components/privacy/cookie-banner'
import { consentContent } from '@/data/online-store'
import { COOKIE_SETTINGS_HASH } from '@/lib/cookie-settings'
import { recordConsentAction } from '@/lib/privacy-actions'

type ConsentManagerProps = {
  tracking: ConsentPreferences['tracking']
  /** Settings → Customer privacy: custom banner text (empty for the default) and its version. */
  bannerMessage: string
  bannerVersion: number
  /** The choice read from the cookie on the server; null until the shopper decides. */
  initial: StoredConsent | null
  /** This request's script CSP nonce; the tracking tags need it to run. */
  nonce?: string | undefined
  /**
   * The footer group's CookieBanner section (its look and labels), when the theme has one.
   * Only the banner changes: the cookie, the version check and what each answer loads do not.
   */
  appearance?: CookieBannerSettings | undefined
  /**
   * An imported Shopify theme draws its own banner (`lib/liquid-shim.ts` answers its
   * `Shopify.customerPrivacy` calls): no banner here, only the answer it sends.
   */
  themeBanner?: boolean | undefined
}

/** The event the imported theme's banner sends with the shopper's choice. */
const THEME_CONSENT_EVENT = 'commerce:consent'

function remember(consent: Consent, version: number): void {
  const secure = window.location.protocol === 'https:' ? '; secure' : ''
  // biome-ignore lint/suspicious/noDocumentCookie: one first-party cookie; the Cookie Store API is not in Safari or Firefox.
  document.cookie = `${CONSENT_COOKIE}=${encodeConsent(consent, version, new Date())}; path=/; max-age=${CONSENT_MAX_AGE}; samesite=lax${secure}`
}

/**
 * The cookie banner (DPDP: necessary always on, analytics and marketing only
 * after a yes) and everything it gates: our own visit beacon (analytics), GA4
 * and Tag Manager (analytics) and the Meta pixel (marketing). Nothing optional
 * renders before consent; each loads the moment its category is allowed,
 * without a reload. A choice made for an older banner version does not count.
 */
export default function ConsentManager({
  tracking,
  bannerMessage,
  bannerVersion,
  initial,
  nonce,
  appearance,
  themeBanner,
}: ConsentManagerProps) {
  // Hooks
  const [consent, setConsent] = useState<Consent | null>(currentConsent(initial, bannerVersion))
  const [reopened, setReopened] = useState(false)

  useEffect(() => {
    const check = () => {
      if (window.location.hash !== COOKIE_SETTINGS_HASH) return
      setReopened(true)
      // Drop the hash so the same link works again next time.
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [])

  useEffect(() => {
    if (!themeBanner) return
    const handleThemeChoice = (event: Event) => {
      const detail = (event as CustomEvent<{ analytics?: unknown; marketing?: unknown }>).detail
      const next = { analytics: detail?.analytics === true, marketing: detail?.marketing === true }
      remember(next, bannerVersion)
      setConsent(next)
      void recordConsentAction(next).catch(() => undefined)
    }
    window.addEventListener(THEME_CONSENT_EVENT, handleThemeChoice)
    return () => window.removeEventListener(THEME_CONSENT_EVENT, handleThemeChoice)
  }, [themeBanner, bannerVersion])

  // Event handlers
  const handleChoose = (next: Consent) => {
    remember(next, bannerVersion)
    setConsent(next)
    setReopened(false)
    // The proof row; the cookie above already works if this fails.
    void recordConsentAction(next).catch(() => undefined)
  }

  // Render logic
  const tags = allowedTags({ tracking }, consent)
  const asking = !themeBanner && (consent === null || reopened)
  const current = consent ?? { analytics: false, marketing: false }

  return (
    <>
      {consent?.analytics ? <VisitBeacon /> : null}
      <TrackingTags {...tags} nonce={nonce} />
      {asking && appearance ? (
        <ZeroDriftCookieBanner
          {...appearance}
          storeMessage={bannerMessage}
          initial={current}
          startChoosing={reopened}
          onChoose={handleChoose}
          labels={{ save: consentContent.save, categories: consentContent.categories }}
        />
      ) : null}
      {asking && !appearance ? (
        <CookieBanner
          message={bannerMessage}
          initial={current}
          startChoosing={reopened}
          onChoose={handleChoose}
        />
      ) : null}
    </>
  )
}
