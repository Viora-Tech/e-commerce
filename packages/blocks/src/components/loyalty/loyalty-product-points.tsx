'use client'

import { type CSSProperties, useEffect, useState } from 'react'
import { loadLoyaltyView } from './loyalty-client'
import { earnInfoOf, earnPreview, pointsWorthPaise } from './loyalty-math'
import LoyaltyProductLine from './loyalty-product-line'
import { loyaltyStyleVars, resolveLoyaltyWidgetSettings } from './loyalty-settings'
import type { LoyaltyView } from './loyalty-types'

type LoyaltyProductPointsProps = {
  /** The price the line counts from (the product's default variant); null in the editor. */
  pricePaise: number | null
  /** Add "(worth ₹N)" to the points. */
  showWorth: boolean
}

/** The block draws in the widget's default colours (the store's brand is applied by the embed). */
const VARS = loyaltyStyleVars(resolveLoyaltyWidgetSettings({})) as CSSProperties

/**
 * The "Points on product" app block (Essential's "Custom position"): the same points line the
 * widget puts above the buy buttons, where the merchant placed it. Its marker tells the widget
 * not to add a second one. Read after the page draws, so it never slows the product page.
 */
export default function LoyaltyProductPoints({ pricePaise, showWorth }: LoyaltyProductPointsProps) {
  // Hooks
  const [view, setView] = useState<LoyaltyView | null>(null)
  useEffect(() => {
    let live = true
    void loadLoyaltyView().then((v) => {
      if (live) setView(v)
    })
    return () => {
      live = false
    }
  }, [])

  // Render logic
  const points = view && pricePaise ? earnPreview(pricePaise, earnInfoOf(view)) : 0
  const shown = !!view?.live && points > 0 && !(view.signedIn && !view.member)
  return (
    <div data-kl-product-block className={`kl-loyalty ${shown ? 'py-3' : ''}`} style={VARS}>
      {shown && view ? (
        <LoyaltyProductLine
          points={points}
          names={view.pointsName}
          balance={view.member ? view.member.points : null}
          worthPaise={showWorth ? pointsWorthPaise(points, view) : null}
        />
      ) : null}
    </div>
  )
}
