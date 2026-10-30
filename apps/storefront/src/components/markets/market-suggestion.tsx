'use client'

import { Icon } from '@commerce/blocks'
import { usePathname } from 'next/navigation'
import { type FormEvent, useEffect, useState } from 'react'
import { marketSuggestionContent as copy } from '@/data/markets'
import { countryName } from '@/lib/checkout-countries'
import { isSuggestionFreePath, type MarketSuggestion as Suggestion } from '@/lib/market-suggestion'

/** The country selector's own action: saves the choice and goes back to the page in that market. */
const SWITCH_ACTION = '/theme-actions/localization'

/* Same sizing as the cookie banner's buttons: they share a row and wrap when they do not fit. */
const BUTTON = 'btn btn--small min-w-fit grow basis-32'

const here = () => window.location.pathname + window.location.search

/**
 * "Shopping from the UAE? Shop in AED": a small card offering the market of the visitor's
 * country when the page shows another one. Asked for after the page loads
 * (`/theme-actions/market-suggestion`), so cached pages stay the same for every visitor; it never
 * redirects by itself. "Shop in" posts the country selector's form (same page, new market);
 * "Stay" saves the market shown, so it is not offered again. Not in frames (theme editor,
 * thumbnails) and never on checkout or account pages.
 */
export default function MarketSuggestion() {
  // Hooks
  const pathname = usePathname()
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    if (window.self !== window.top) return
    const query = new URLSearchParams({ path: window.location.pathname })
    // Local testing without Cloudflare: `?visitor_country=AE` (the route honours it outside production).
    const fake = new URLSearchParams(window.location.search).get('visitor_country')
    if (fake) query.set('country', fake)
    const controller = new AbortController()
    fetch(`/theme-actions/market-suggestion?${query}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { suggestion?: Suggestion | null } | null) => {
        setSuggestion(body?.suggestion ?? null)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  // Event handlers
  const handleSwitch = (event: FormEvent<HTMLFormElement>) => {
    const field = event.currentTarget.elements.namedItem('return_to')
    if (field instanceof HTMLInputElement) field.value = here()
  }
  const handleStay = () => {
    setClosed(true)
    if (!suggestion) return
    const body = new FormData()
    body.set('country_code', suggestion.current.country)
    body.set('language_code', suggestion.current.language)
    body.set('return_to', here())
    // The answer is a redirect back here; only its cookie (the saved choice) matters.
    fetch(SWITCH_ACTION, { method: 'POST', body, redirect: 'manual', keepalive: true }).catch(
      () => {},
    )
  }

  // Early returns
  if (!suggestion || closed || isSuggestionFreePath(pathname)) return null

  // Render logic
  const country = countryName(suggestion.country)

  return (
    <div className="pointer-events-none fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex justify-center sm:inset-x-auto sm:top-5 sm:right-5 sm:justify-end">
      <section
        aria-label={copy.label}
        className="pointer-events-auto flex w-full min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-4 text-ink shadow-lg transition-[opacity,scale] duration-200 ease-out [overflow-wrap:anywhere] starting:scale-[0.97] starting:opacity-0 motion-reduce:starting:scale-100 sm:w-[22rem]"
      >
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 grow flex-col gap-1">
            <p className="text-base font-semibold">{copy.question(country)}</p>
            <p className="text-sm text-muted">{copy.body(suggestion.currency)}</p>
          </div>
          <button
            type="button"
            className="-m-1 shrink-0 touch-manipulation p-1 text-muted"
            aria-label={copy.close}
            onClick={handleStay}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <form
          method="post"
          action={SWITCH_ACTION}
          onSubmit={handleSwitch}
          className="flex flex-wrap gap-2"
        >
          <input type="hidden" name="country_code" defaultValue={suggestion.country} />
          <input type="hidden" name="language_code" defaultValue="" />
          <input type="hidden" name="return_to" defaultValue="/" />
          <button type="button" className={`${BUTTON} btn--secondary`} onClick={handleStay}>
            {copy.stay(suggestion.current.currency)}
          </button>
          <button type="submit" className={`${BUTTON} btn--primary`}>
            {copy.switch(suggestion.currency)}
          </button>
        </form>
      </section>
    </div>
  )
}
