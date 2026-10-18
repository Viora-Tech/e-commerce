'use client'

import { useEffect, useRef } from 'react'
import { loadTurnstile, TURNSTILE_SITE_KEY, trackWidget, untrackWidget } from '@/lib/turnstile'

type TurnstileProps = { action: string }

// The bot check inside a form. Invisible unless Turnstile wants a click; it adds the hidden
// `cf-turnstile-response` field the form submits.
export default function Turnstile({ action }: TurnstileProps) {
  // Hooks
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let widgetId: string | null = null
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !ref.current) return
        widgetId = turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          appearance: 'interaction-only',
        })
        trackWidget(widgetId)
      })
      .catch(() => {
        // No widget means no token; the submit reports the error and the visitor can retry.
      })
    return () => {
      cancelled = true
      if (widgetId) {
        untrackWidget(widgetId)
        window.turnstile?.remove(widgetId)
      }
    }
  }, [action])

  return <div ref={ref} className="empty:hidden" />
}
