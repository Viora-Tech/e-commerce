'use client'

import { type CSSProperties, lazy, Suspense, useEffect, useRef, useState } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { recordLoyaltyVisit } from './loyalty-client'
import LoyaltyIcon from './loyalty-icon'
import { loyaltyStyleVars, resolveLoyaltyWidgetSettings } from './loyalty-settings'

type LoyaltyLauncherProps = {
  /** The embed's saved settings (theme editor → App embeds → Loyalty widget). */
  settings: Record<string, unknown>
  storeName: string
  /** The request carried a shopper session cookie. */
  signedIn: boolean
  /** False in the theme editor's canvas: a picture only, nothing is fetched. */
  live: boolean
}

// The panel and the price lines load only when needed, so the launcher stays a few kB.
const loadPanel = () => import('./loyalty-panel')
const LoyaltyPanel = lazy(loadPanel)
const LoyaltyPricePoints = lazy(() => import('./loyalty-price-points'))

const VISIT_KEY = 'kl-loyalty-visit'

/** Today in the browser's calendar: the daily visit is asked for at most once a day. */
const today = () => new Date().toDateString()

function visitedToday(): boolean {
  try {
    return window.localStorage.getItem(VISIT_KEY) === today()
  } catch {
    return false
  }
}

function markVisited(): void {
  try {
    window.localStorage.setItem(VISIT_KEY, today())
  } catch {
    // Private mode: the server counts one visit a day anyway.
  }
}

/**
 * The Loyalty widget (an app embed, on every page): a floating button that opens the rewards
 * panel. The panel's code is fetched on the first open (or hover), never on first paint. A
 * signed-in shopper's daily visit is sent once a day. Styles are the widget's own (`--kl-*`), so
 * an imported theme's CSS variables never recolour it.
 */
export default function LoyaltyLauncher({
  settings,
  storeName,
  signedIn,
  live,
}: LoyaltyLauncherProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!live || !signedIn || visitedToday()) return
    const id = window.setTimeout(() => {
      void recordLoyaltyVisit().then((r) => {
        if (r) markVisited()
      })
    }, 1500)
    return () => window.clearTimeout(id)
  }, [live, signedIn])

  // Event handlers
  const handleToggle = () => {
    setMounted(true)
    setOpen((o) => !o)
  }
  const handleClose = () => {
    setOpen(false)
    button.current?.focus()
  }
  const handlePreload = () => {
    if (live) void loadPanel()
  }

  // Render logic
  const s = resolveLoyaltyWidgetSettings(settings)
  const side = s.position === 'left' ? 'left-4' : 'right-4'
  const vars = loyaltyStyleVars(s) as CSSProperties
  return (
    <div className="kl-loyalty font-sans" style={vars}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-label={copy.open}
        onClick={handleToggle}
        onPointerEnter={handlePreload}
        onFocus={handlePreload}
        className={`fixed bottom-4 z-[2147483000] inline-flex h-12 touch-manipulation items-center gap-2 rounded-full border-0 bg-(image:--kl-head) bg-(--kl-head-solid) px-4 text-[0.9375rem] font-semibold normal-case leading-none tracking-normal text-(--kl-head-text) shadow-lg transition-[scale] duration-150 ease-out active:scale-95 ${side}`}
      >
        {s.launcherIcon === 'none' ? null : <LoyaltyIcon name={s.launcherIcon} />}
        {s.launcherText ? <span>{s.launcherText}</span> : null}
      </button>
      {mounted && live ? (
        <Suspense fallback={null}>
          <LoyaltyPanel
            open={open}
            settings={s}
            storeName={storeName}
            signedIn={signedIn}
            onClose={handleClose}
          />
        </Suspense>
      ) : null}
      {live && (s.cardPoints || s.priceSelector) ? (
        <Suspense fallback={null}>
          <LoyaltyPricePoints selector={s.priceSelector} ownCards={s.cardPoints} />
        </Suspense>
      ) : null}
    </div>
  )
}
