'use client'

import { type CSSProperties, useEffect, useState } from 'react'
import LoyaltyCartBox from './loyalty-cart-box'
import { loadLoyaltyView } from './loyalty-client'
import { loyaltyStyleVars, resolveLoyaltyWidgetSettings } from './loyalty-settings'
import type { LoyaltyView } from './loyalty-types'

type LoyaltyCartRedeemProps = {
  /** Add "(worth ₹N)" to the points this order earns. */
  showWorth: boolean
  /** False in the theme editor: a picture only. */
  live: boolean
}

const VARS = loyaltyStyleVars(resolveLoyaltyWidgetSettings({})) as CSSProperties

/**
 * The "Redeem in cart" app block (Essential's "Custom position"): the same points box the
 * widget puts above Checkout, where the merchant placed it. Its marker tells the widget not to
 * add a second one.
 */
export default function LoyaltyCartRedeem({ showWorth, live }: LoyaltyCartRedeemProps) {
  // Hooks
  const [view, setView] = useState<LoyaltyView | null>(null)
  useEffect(() => {
    if (!live) return
    let on = true
    void loadLoyaltyView({ cart: true }).then((v) => {
      if (on) setView(v)
    })
    return () => {
      on = false
    }
  }, [live])

  // Render logic
  return (
    <div data-kl-cart-block className="kl-loyalty" style={VARS}>
      {view ? <LoyaltyCartBox view={view} showWorth={showWorth} /> : null}
    </div>
  )
}
