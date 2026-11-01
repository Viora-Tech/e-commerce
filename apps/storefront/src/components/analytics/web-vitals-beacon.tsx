'use client'

import { useReportWebVitals } from 'next/web-vitals'

const VITALS_PATH = '/api/vitals'
/** Google's three Core Web Vitals; Next also reports FCP and TTFB, which the report leaves out. */
const KEPT = new Set(['LCP', 'INP', 'CLS'])
/** Under this width a screen counts as a phone, as the admin's Web performance strip splits it. */
const MOBILE_MAX_WIDTH = 768

/** Theme previews (Customize, the worker's screenshots) are not shoppers: their speed is not reported. */
function isShopperPage(): boolean {
  if (window.top !== window.self) return false
  return !new URLSearchParams(window.location.search).has('theme-preview')
}

/**
 * Real-user speed for the admin's Online store page: each page's LCP, INP and CLS (Next's
 * built-in web-vitals reporter, sent once per page as the browser settles them) go to
 * `/api/vitals` with the path and a phone/desktop class. Anonymous: no cookies, no ids.
 */
export default function WebVitalsBeacon() {
  // Hooks
  useReportWebVitals((metric) => {
    if (!KEPT.has(metric.name) || !isShopperPage()) return
    const body = JSON.stringify({
      path: window.location.pathname,
      device: window.innerWidth < MOBILE_MAX_WIDTH ? 'mobile' : 'desktop',
      readings: [{ metric: metric.name, value: metric.value }],
    })
    if (navigator.sendBeacon?.(VITALS_PATH, new Blob([body], { type: 'application/json' }))) return
    void fetch(VITALS_PATH, {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body,
    }).catch(() => undefined)
  })

  // Render logic
  return null
}
