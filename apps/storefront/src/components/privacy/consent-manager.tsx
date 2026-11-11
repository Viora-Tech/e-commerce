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
import {
  type ChatwootIdentity,
  type ChatwootWidget as ChatwootWidgetConfig,
  chatwootAllowed,
} from '@commerce/plugin-chatwoot/widget'
import { syncUmamiOptOut, type UmamiTracker, umamiAllowed } from '@commerce/plugin-umami/tracker'
import { useEffect, useRef, useState } from 'react'
import DiscoveryTracker from '@/components/analytics/discovery-tracker'
import PixelEvents from '@/components/analytics/pixel-events'
import TrackingTags from '@/components/analytics/tracking-tags'
import UmamiScript from '@/components/analytics/umami-script'
import VisitBeacon from '@/components/analytics/visit-beacon'
import WebVitalsBeacon from '@/components/analytics/web-vitals-beacon'
import CookieBanner from '@/components/privacy/cookie-banner'
import ChatwootWidget from '@/components/support/chatwoot-widget'
import { consentContent } from '@/data/online-store'
import { usePendingReferral } from '@/hooks/use-pending-referral'
import { COOKIE_SETTINGS_HASH } from '@/lib/cookie-settings'
import type { BrowserPixel } from '@/lib/pixels/track'
import { recordConsentAction } from '@/lib/privacy-actions'

type ConsentManagerProps = {
  tracking: ConsentPreferences['tracking']
  /** Settings → Customer privacy: custom banner text (empty for the default) and its version. */
  bannerMessage: string
  bannerVersion: number
  /**
   * The Pixels app's pixels when the store installed it (then the old single Meta pixel in
   * `tracking` is ignored); null without the app. They load, like the old pixel, only after a
   * yes to marketing.
   */
  pixels?: BrowserPixel[] | null | undefined
  /** The choice read from the cookie on the server; null until the shopper decides. */
  initial: StoredConsent | null
  /** This request's script CSP nonce; the tracking tags need it to run. */
  nonce?: string | undefined
  /**
   * The Umami app's tracker, when installed and set up. Cookieless, so the store may let it
   * count visitors who have not answered yet (`waitForConsent: false`); a no always stops it.
   */
  umami?: UmamiTracker | null | undefined
  /**
   * The Chatwoot app's chat, when installed and set up, with the signed-in shopper's signed
   * identity. Loads after the cookie category the store picked (`necessary`: for everyone).
   */
  chatwoot?: { widget: ChatwootWidgetConfig; identity: ChatwootIdentity | null } | null | undefined
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

/** The page's local storage, or null where the browser blocks it. */
function localStore(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const SHOWN_KEY = 'wc_banner_shown'

/** Counts the banner once per tab: `/api/consent-shown` keeps a plain daily number. */
function reportBannerShown(): void {
  try {
    if (sessionStorage.getItem(SHOWN_KEY)) return
    sessionStorage.setItem(SHOWN_KEY, '1')
    navigator.sendBeacon('/api/consent-shown')
  } catch {
    // Blocked storage: this visit goes uncounted.
  }
}

/**
 * The cookie banner (DPDP: necessary always on, analytics and marketing only
 * after a yes) and everything it gates: our own visit beacon, GA4, Tag Manager and
 * the Umami app's tracker (analytics) and the Meta pixel (marketing). Nothing
 * optional renders before consent, except Umami (cookieless) when the store chose
 * not to wait; each loads the moment its category is allowed, without a reload,
 * and a no stops them all. A choice made for an older banner version does not count.
 * The Chatwoot app's chat waits for the category its store picked (none by default: a
 * chat is something the shopper asks for).
 */
export default function ConsentManager({
  tracking,
  bannerMessage,
  bannerVersion,
  initial,
  nonce,
  pixels,
  appearance,
  themeBanner,
  umami,
  chatwoot,
}: ConsentManagerProps) {
  // Hooks
  const [consent, setConsent] = useState<Consent | null>(currentConsent(initial, bannerVersion))
  const [reopened, setReopened] = useState(false)
  const initialUnanswered = useRef(consent === null)

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
    if (initialUnanswered.current) reportBannerShown()
  }, [])

  // A loaded Umami keeps counting page views by itself: a no must also flip its own off switch.
  useEffect(() => {
    if (umami) syncUmamiOptOut(localStore(), umamiAllowed(umami, consent))
  }, [umami, consent])

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

  // The affiliate referral cookie waits for a yes to marketing (`hooks/use-pending-referral.ts`).
  usePendingReferral(consent?.marketing === true)

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
  // With the Pixels app, its pixels replace the old single one.
  const appPixels = pixels && consent?.marketing ? pixels : null
  const asking = !themeBanner && (consent === null || reopened)
  const current = consent ?? { analytics: false, marketing: false }

  return (
    <>
      {/* Every visit counts: without a yes the server counts it cookieless (totals only). */}
      <VisitBeacon consented={consent?.analytics === true} />
      {consent?.analytics ? <DiscoveryTracker /> : null}
      {/* Anonymous page speed (no cookies, no ids): reported whatever the consent. */}
      <WebVitalsBeacon />
      <TrackingTags
        {...tags}
        metaPixel={pixels ? null : tags.metaPixel}
        pixels={appPixels?.map((p) => p.id)}
        nonce={nonce}
      />
      {appPixels?.length ? <PixelEvents pixels={appPixels} /> : null}
      {umami && umamiAllowed(umami, consent) ? <UmamiScript tracker={umami} nonce={nonce} /> : null}
      {chatwoot && chatwootAllowed(chatwoot.widget, consent) ? (
        <ChatwootWidget widget={chatwoot.widget} identity={chatwoot.identity} nonce={nonce} />
      ) : null}
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
