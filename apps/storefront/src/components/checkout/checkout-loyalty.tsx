'use client'

import {
  applyLoyaltyCode,
  earnPreview,
  type LoyaltyEarnInfo,
  type LoyaltyRewardView,
  type LoyaltyView,
  loadEarnInfo,
  loadLoyaltyView,
  loyaltyWidgetContent,
  redeemReward,
  rewardCost,
  rewardsForCart,
  rewardValueLabel,
} from '@commerce/blocks/loyalty'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'

type CheckoutLoyaltyProps = {
  /** The goods the order's points are counted on (subtotal after the discount). */
  goodsPaise: number
  /** A discount code is on the cart already: rewards are codes, and a cart holds one. */
  hasCode: boolean
}

/**
 * Loyalty points in the checkout summary, beside store credit: "You'll earn 12 points with this
 * order" for a member, a sign-in line for a visitor, and the rewards the member's points buy that
 * fit this cart. Apply claims the reward and puts its code on the cart through the same discount
 * path as a typed code (`/api/loyalty/apply`, then the page re-reads its totals): no pricing
 * of its own. Nothing shows unless the Loyalty app is installed and its program is live.
 */
export default function CheckoutLoyalty({ goodsPaise, hasCode }: CheckoutLoyaltyProps) {
  // Hooks
  const router = useRouter()
  const [view, setView] = useState<LoyaltyView | null>(null)
  const [earn, setEarn] = useState<LoyaltyEarnInfo | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let on = true
    void Promise.all([loadLoyaltyView({ cart: true }), loadEarnInfo()]).then(([v, e]) => {
      if (!on) return
      setView(v)
      setEarn(e)
    })
    return () => {
      on = false
    }
  }, [])

  // Event handlers
  const handleApply = async (r: LoyaltyRewardView) => {
    setBusy(r.id)
    setFailed(false)
    const done = await redeemReward(
      r.id,
      r.type === 'custom_amount_off' ? rewardCost(r) : undefined,
    )
    const applied = done?.code ? await applyLoyaltyCode(done.code) : null
    setBusy(null)
    if (applied?.ok) {
      router.refresh()
      return
    }
    setFailed(true)
  }

  // Early returns
  if (!view?.live || !earn?.live) return null
  if (!view.member && (view.signedIn || earnPreview(goodsPaise, earn) <= 0)) return null

  // Render logic
  const copy = loyaltyWidgetContent
  const names = view.pointsName
  const points = earnPreview(goodsPaise, earn)
  const member = view.member
  const fits =
    !member || hasCode || !view.cart
      ? []
      : rewardsForCart(view.rewards, {
          points: member.points,
          subtotalPaise: view.cart.subtotalPaise,
          productIds: view.cart.productIds,
        })
  return (
    <div className="flex flex-col gap-2 py-1 text-[0.875rem]">
      {!member ? (
        <p className="m-0 flex items-center gap-2.5">
          <CheckoutIcon name="gift" className="size-4 shrink-0 text-ck-summary-muted" />
          <a
            href="/account/login?return_to=%2Fcheckout"
            className="text-ck-summary-ink! underline underline-offset-4"
          >
            {copy.checkout.join(copy.points(points, names))}
          </a>
        </p>
      ) : points > 0 ? (
        <span className="flex items-start gap-2.5">
          <CheckoutIcon name="gift" className="mt-0.5 size-4 shrink-0 text-ck-summary-muted" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span>{copy.checkout.earn(copy.points(points, names))}</span>
            <span className="text-[0.8125rem] text-ck-summary-muted">
              {copy.checkout.earnLater}
            </span>
          </span>
        </span>
      ) : null}
      {fits.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-[var(--ck-radius)] bg-ck-summary-line p-3">
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-semibold">{copy.checkout.use}</span>
            <span className="text-[0.8125rem] text-ck-summary-muted">
              {copy.checkout.balance(copy.points(member?.points ?? 0, names))}
            </span>
          </span>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {fits.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-[0.8125rem] text-ck-summary-muted">
                    {rewardValueLabel(r)} · {copy.points(rewardCost(r), names)}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => handleApply(r)}
                  className="shrink-0 rounded-full bg-ck-summary-ink! px-3.5 py-1.5 text-[0.8125rem] font-semibold text-ck-summary! disabled:opacity-60"
                >
                  {busy === r.id ? copy.cart.applying : copy.cart.apply}
                </button>
              </li>
            ))}
          </ul>
          {failed ? (
            <p role="alert" className="m-0 text-[0.8125rem] text-ck-danger">
              {copy.cart.failed}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
