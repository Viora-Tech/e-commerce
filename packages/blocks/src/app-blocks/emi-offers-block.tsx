'use client'

import { useEffect, useRef, useState } from 'react'
import { formatPaise } from '../money'
import {
  AFFORDABILITY_ELEMENT_ID,
  claimAffordabilitySlot,
  isDarkTheme,
  loadAffordabilityScript,
  releaseAffordabilitySlot,
  renderAffordability,
} from './razorpay-affordability'

/**
 * One product price's EMI offer, worked out by the EMI & pay later app
 * (`emiOfferFor` in `@commerce/plugin-emi/offer`) and handed to this block
 * through `puck.metadata.appBlockContext.emiOffers`, or by the buy box's
 * under-price slot for the selected variant.
 */
export type EmiOffersContext = {
  amountPaise: number
  /** Our own "from ₹X/month" figure: shown first, and kept whenever Razorpay's widget is not. */
  monthlyPaise: number
  /** Public Razorpay key id when the store shows Razorpay's official widget; null for the plain line. */
  razorpayKeyId: string | null
}

export type EmiOffersCopy = {
  label: (monthly: string) => string
  detail: string
}

type EmiOffersBlockProps = {
  context: EmiOffersContext | null | undefined
  copy: EmiOffersCopy
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * "or ₹X/month with EMI or pay later" under a product price. With Razorpay
 * chosen, Razorpay's Affordability Widget replaces the line once it loads,
 * showing the merchant's real lenders, plans and offers. The plain line stays
 * when the script is blocked or fails, when another copy of this block
 * already holds the widget, and in the dark theme (the widget's dark mode is
 * a Razorpay Dashboard setting we cannot read, so we do not risk a light
 * panel on a dark page). The line is static text, so it renders on the
 * server with no layout shift; the widget only fades in when the shopper
 * allows motion.
 */
export default function EmiOffersBlock({ context, copy }: EmiOffersBlockProps) {
  // Hooks
  const [dark, setDark] = useState<boolean | null>(null)
  const [widgetShown, setWidgetShown] = useState(false)
  const slot = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia(DARK_QUERY)
    const update = () => setDark(isDarkTheme(root, media.matches))
    update()
    media.addEventListener('change', update)
    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      media.removeEventListener('change', update)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const el = slot.current
    const keyId = context?.razorpayKeyId
    const amount = context?.amountPaise ?? 0
    // `dark` is null until the theme is read, so a dark page never flashes the widget.
    if (!el || !keyId || amount <= 0 || dark !== false) return
    const owner = {}
    if (!claimAffordabilitySlot(owner)) return
    let live = true
    el.id = AFFORDABILITY_ELEMENT_ID
    loadAffordabilityScript(document, window)
      .then(() => {
        if (live) setWidgetShown(renderAffordability(window, { key: keyId, amount }))
      })
      .catch(() => {
        if (live) setWidgetShown(false)
      })
    return () => {
      live = false
      releaseAffordabilitySlot(owner)
      el.removeAttribute('id')
      el.replaceChildren()
      setWidgetShown(false)
    }
  }, [context?.razorpayKeyId, context?.amountPaise, dark])

  // Early returns
  if (!context) return null

  // Render logic
  const monthly = formatPaise(context.monthlyPaise)

  return (
    <div className="emi-offers">
      {widgetShown ? null : (
        <p className="emi-offers__line text-small">
          {copy.label(monthly)}
          <span className="emi-offers__detail text-caption">{copy.detail}</span>
        </p>
      )}
      <div
        ref={slot}
        className={widgetShown ? 'emi-offers__widget is-shown' : 'emi-offers__widget'}
      />
    </div>
  )
}
