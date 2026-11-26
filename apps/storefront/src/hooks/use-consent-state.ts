'use client'

import {
  type Consent,
  type ConsentRegion,
  effectiveConsent,
  type PageConsentRegion,
  type StoredConsent,
} from '@commerce/core/consent'
import { useEffect, useRef, useState } from 'react'
import { fetchRegion, knownRegion } from '@/lib/consent-region-client'

declare global {
  interface Window {
    /** The shim's hook for a region learned after the page was drawn (`lib/liquid-shim.ts`). */
    __commerceConsentRegion?: (ask: boolean) => void
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

export type ConsentState = {
  /** `pending` until a page drawn without the region has learned it. */
  region: PageConsentRegion
  /** What counts now: a choice made here, else `effectiveConsent` for the region. */
  consent: Consent | null
  /** The banner should ask: a region where it asks, and no answer for this banner version. */
  unanswered: boolean
  /** Records a choice made on this page (the caller stores the cookie and the proof row). */
  choose: (next: Consent) => void
}

/**
 * The consent `ConsentManager` gates on, Shopify's way (`lib/consent-cookie.ts`). A page a
 * shared cache may keep is drawn `pending`: the region is learned here (`/api/consent-region`,
 * once per tab) and handed to an imported theme's banner. Counts the banner once when it asks,
 * and keeps `window.__commerceConsent` current for code outside React.
 */
export function useConsentState(input: {
  initial: StoredConsent | null
  bannerVersion: number
  region: PageConsentRegion
  themeBanner: boolean
}): ConsentState {
  const { initial, bannerVersion, region: drawn, themeBanner } = input
  const [chosen, setChosen] = useState<Consent | null>(null)
  const [learned, setLearned] = useState<ConsentRegion | null>(null)
  const reported = useRef(false)
  const region: PageConsentRegion = drawn === 'pending' ? (learned ?? 'pending') : drawn
  const consent = chosen ?? effectiveConsent(initial, bannerVersion, region)
  const unanswered = region === 'ask' && consent === null

  useEffect(() => {
    if (drawn !== 'pending') return
    const known = knownRegion()
    if (known) {
      setLearned(known)
      return
    }
    let live = true
    void fetchRegion().then((r) => {
      if (live) setLearned(r)
    })
    return () => {
      live = false
    }
  }, [drawn])

  // An imported theme's banner waits on the shim while the region is pending.
  useEffect(() => {
    if (!themeBanner || drawn !== 'pending' || region === 'pending') return
    window.__commerceConsentRegion?.(unanswered)
  }, [themeBanner, drawn, region, unanswered])

  useEffect(() => {
    window.__commerceConsent = consent
  }, [consent])

  useEffect(() => {
    if (!unanswered || reported.current) return
    reported.current = true
    reportBannerShown()
  }, [unanswered])

  return { region, consent, unanswered, choose: setChosen }
}
