'use client'

import { pendingCommerceTracks, trackCommerce } from '@commerce/blocks'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { type BrowserPixel, listenForPixelEvents, sendPixelEvent } from '@/lib/pixels/track'
import { trackingAllowedOn } from '@/lib/tracking-paths'

type PixelEventsProps = {
  /** The store's pixels, already cleared by marketing consent. */
  pixels: BrowserPixel[]
}

/**
 * The Pixels app's listener, rendered by the consent manager only after a yes to marketing.
 * Sends a PageView on every navigation and every `commerce:track` event a page or block
 * fires (including ones fired before it mounted), to the browser pixels and `/api/px`.
 */
export default function PixelEvents({ pixels }: PixelEventsProps) {
  // Hooks
  const pathname = usePathname()

  useEffect(() => {
    for (const detail of pendingCommerceTracks()) sendPixelEvent(pixels, detail)
    return listenForPixelEvents(pixels)
  }, [pixels])

  // One PageView per route change.
  useEffect(() => {
    if (trackingAllowedOn(pathname)) trackCommerce({ name: 'PageView' })
  }, [pathname])

  // Render logic
  return null
}
