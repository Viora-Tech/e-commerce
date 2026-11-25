'use client'

import { useEffect, useState } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { applyLoyaltyCode, loadLoyaltyView, redeemReward } from './loyalty-client'
import { rewardValueLabel } from './loyalty-format'
import { rewardCost, rewardsForCart } from './loyalty-math'
import type { LoyaltyRewardView, LoyaltyView } from './loyalty-types'

type LoyaltyCartRedeemProps = {
  heading: string
  /** False in the theme editor: a picture only. */
  live: boolean
}

/**
 * The "Redeem in cart" block: the member's points and the rewards that fit this cart (enough
 * points, the minimum order met, a free product that is in the cart). Apply claims the reward
 * and puts its code on the cart in one click, then reloads the cart. A visitor who is not signed
 * in gets a sign-in link.
 */
export default function LoyaltyCartRedeem({ heading, live }: LoyaltyCartRedeemProps) {
  // Hooks
  const [view, setView] = useState<LoyaltyView | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
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

  // Event handlers
  const handleApply = async (r: LoyaltyRewardView) => {
    setBusy(r.id)
    setFailed(false)
    const done = await redeemReward(
      r.id,
      r.type === 'custom_amount_off' ? rewardCost(r) : undefined,
    )
    const applied = done?.code ? await applyLoyaltyCode(done.code) : null
    if (applied?.ok) {
      window.location.reload()
      return
    }
    setBusy(null)
    setFailed(true)
  }

  // Early returns
  if (!view?.live || !view.cart || view.rewards.length === 0) return null
  if (!view.member) {
    if (view.signedIn) return null
    return (
      <p className="m-0 text-sm text-ink">
        <a href="/account/login?return_to=%2Fcart" className="underline">
          {copy.cart.join}
        </a>
      </p>
    )
  }

  // Render logic
  const names = view.pointsName
  const fits = rewardsForCart(view.rewards, {
    points: view.member.points,
    subtotalPaise: view.cart.subtotalPaise,
    productIds: view.cart.productIds,
  })
  return (
    <section className="flex flex-col gap-2 rounded-[var(--radius-m,0.5rem)] border border-line p-4 text-ink">
      <h3 className="m-0 font-[inherit] text-base! font-semibold! tracking-normal! normal-case!">{heading || copy.cart.title}</h3>
      <p className="m-0 text-sm text-muted">
        {copy.cart.balance(copy.points(view.member.points, names))}
      </p>
      {view.cart.discountCode ? (
        <p className="m-0 text-sm">{copy.cart.applied(view.cart.discountCode)}</p>
      ) : fits.length === 0 ? (
        <p className="m-0 text-sm text-muted">{copy.cart.none}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {fits.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 flex-col text-sm">
                <span className="font-medium">{r.title}</span>
                <span className="text-muted">
                  {rewardValueLabel(r)} · {copy.points(rewardCost(r), names)}
                </span>
              </span>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => handleApply(r)}
                className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-on-brand disabled:opacity-60"
              >
                {busy === r.id ? copy.cart.applying : copy.cart.apply}
              </button>
            </li>
          ))}
        </ul>
      )}
      {failed ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {copy.cart.failed}
        </p>
      ) : null}
    </section>
  )
}
