'use client'

import { useEffect } from 'react'

type ExperimentBeaconProps = {
  /** Tracking keys of the experiments this page was drawn with. */
  seen?: readonly string[] | undefined
  /** The order a thank-you page shows: a purchase for the experiments' numbers. */
  order?: string | undefined
}

const BEACON_PATH = '/api/experiments'

/**
 * Tells the server, once per page, which experiments the page showed (GrowthBook's "experiment
 * viewed") or which order was placed. Rendered only for a shopper the server already assigned
 * after a yes to analytics; the server checks consent again and works out the variation itself.
 */
export default function ExperimentBeacon({ seen, order }: ExperimentBeaconProps) {
  // Hooks
  const payload = JSON.stringify({ seen: seen ?? [], order })

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    if (navigator.sendBeacon) {
      navigator.sendBeacon(BEACON_PATH, new Blob([payload], { type: 'application/json' }))
      return
    }
    void fetch(BEACON_PATH, {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: payload,
    })
  }, [payload])

  // Render logic
  return null
}
