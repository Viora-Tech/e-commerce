'use client'

import type { UmamiTracker } from '@commerce/plugin-umami/settings'
import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { trackingAllowedOn } from '@/lib/tracking-paths'

type UmamiScriptProps = {
  tracker: UmamiTracker
  /** The request's script CSP nonce: the tracker is an external script added by React. */
  nonce?: string | undefined
}

/**
 * The store's Umami tracker (https://umami.is, MIT): cookieless, one small script from the
 * store's Umami, which counts page views itself, client-side navigations included. Rendered
 * only once the consent banner allows it (`umamiAllowed`), never on sign-in pages
 * (`trackingAllowedOn`). `afterInteractive`, so a visit that leaves quickly still counts.
 */
export default function UmamiScript({ tracker, nonce }: UmamiScriptProps) {
  // Hooks
  const pathname = usePathname()

  // Early returns
  if (!trackingAllowedOn(pathname)) return null

  // Render logic
  return (
    <Script
      id="umami"
      src={tracker.src}
      data-website-id={tracker.websiteId}
      strategy="afterInteractive"
      nonce={nonce}
    />
  )
}
