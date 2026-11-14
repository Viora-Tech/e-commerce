'use client'

import { pendingCommerceTracks, trackCommerce } from '@commerce/blocks'
import type { MatchValues } from '@commerce/core/pixels'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  hashShopperFacts,
  listenForShopperFacts,
  loadServerMatch,
  mergeMatch,
} from '@/lib/pixels/match'
import {
  type BrowserPixel,
  initPixels,
  listenForPixelEvents,
  sendPixelEvent,
} from '@/lib/pixels/track'
import { trackingAllowedOn } from '@/lib/tracking-paths'

type PixelEventsProps = {
  /** The store's pixels, already cleared by marketing consent. */
  pixels: BrowserPixel[]
}

/** Wait this long after the last keystroke at checkout before matching again. */
const TYPING_PAUSE_MS = 800

/**
 * The Pixels app's listener, rendered by the consent manager only after a yes to marketing.
 * First initialises each pixel with the shopper's hashed advanced-matching values
 * (`/api/px/me`: signed-in customer, checkout contact), then sends a PageView on every
 * navigation and every `commerce:track` event a page or block fires (including ones fired
 * before it was ready), to the browser pixels and `/api/px`. What the shopper types at checkout
 * updates the matching as they go, hashed in the browser.
 */
export default function PixelEvents({ pixels }: PixelEventsProps) {
  // Hooks
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  // Initialise once, with whatever the server knows (it waits at most a moment).
  useEffect(() => {
    let live = true
    let applied: MatchValues | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let stopFacts: (() => void) | null = null
    void loadServerMatch().then((server) => {
      if (!live) return
      applied = server
      initPixels(pixels, server)
      setReady(true)
      // Checkout: what the shopper types wins key by key over what the server knew.
      stopFacts = listenForShopperFacts((facts) => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          void hashShopperFacts(facts).then((typed) => {
            const next = mergeMatch(applied, typed)
            if (!live || !next || JSON.stringify(next) === JSON.stringify(applied)) return
            applied = next
            initPixels(pixels, next)
          })
        }, TYPING_PAUSE_MS)
      })
    })
    return () => {
      live = false
      if (timer) clearTimeout(timer)
      stopFacts?.()
    }
  }, [pixels])

  useEffect(() => {
    if (!ready) return
    for (const detail of pendingCommerceTracks()) sendPixelEvent(pixels, detail)
    return listenForPixelEvents(pixels)
  }, [pixels, ready])

  // One PageView per route change (queued until the pixels are initialised).
  useEffect(() => {
    if (trackingAllowedOn(pathname)) trackCommerce({ name: 'PageView' })
  }, [pathname])

  // Render logic
  return null
}
