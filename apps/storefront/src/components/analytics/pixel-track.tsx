'use client'

import { type CommerceTrackDetail, trackCommerce } from '@commerce/blocks'
import { useEffect } from 'react'

type PixelTrackProps = {
  /** What happened on this page; fired once when it mounts. */
  event: CommerceTrackDetail
}

/**
 * Fires one storefront event (ViewContent on a product, InitiateCheckout when checkout opens,
 * Purchase on the thank-you page) for the Pixels app. Nothing is sent without marketing
 * consent: the listener only runs after a yes.
 */
export default function PixelTrack({ event }: PixelTrackProps) {
  // Hooks
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per page and event id
  useEffect(() => {
    trackCommerce(event)
  }, [event.name, event.eventId, event.variantId])

  // Render logic
  return null
}
