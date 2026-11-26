'use client'

import { useState } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { formatPaise } from '../../money'
import { forgetLoyaltyView, redeemAndApply } from './loyalty-client'
import LoyaltyIcon from './loyalty-icon'
import {
  cartRewardRows,
  earnInfoOf,
  earnPreview,
  pointsWorthPaise,
  rewardCost,
} from './loyalty-math'
import { ACCENT_LINK, DARK_BUTTON } from './loyalty-styles'
import type { LoyaltyRewardView, LoyaltyView } from './loyalty-types'

type LoyaltyCartBoxProps = {
  /** The shopper's view read with the cart (`?cart=1`). */
  view: LoyaltyView
  /** Add "(worth ₹N)" to the points this order earns. */
  showWorth: boolean
  /** After a reward is applied: the page reloads by default, so the totals follow. */
  onApplied?: (() => void) | undefined
}

/** Sign-in that comes back to the cart. */
const LOGIN = '/account/login?return_to=%2Fcart'

/**
 * The cart's points box above Checkout, Essential Loyalty's way. A visitor: an award ribbon,
 * "+N points for this order" and "Log in to redeem rewards". A member: "N points to redeem" over
 * "+N for this order", with a chevron that opens the rewards: the ones that fit this cart first,
 * the rest greyed with the reason. Picking one shows "Redeem and apply", which claims it and puts
 * its code on the cart (the same claim and discount path as the panel), so the shopper never
 * leaves the cart.
 */
export default function LoyaltyCartBox({ view, showWorth, onApplied }: LoyaltyCartBoxProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  // Event handlers
  const handleRedeem = async (r: LoyaltyRewardView) => {
    setBusy(true)
    setFailed(false)
    const code = await redeemAndApply(r, r.type === 'custom_amount_off' ? rewardCost(r) : undefined)
    if (code) {
      forgetLoyaltyView()
      if (onApplied) onApplied()
      else window.location.reload()
      return
    }
    setBusy(false)
    setFailed(true)
  }

  // Early returns
  if (!view.live || !view.cart) return null
  if (view.signedIn && !view.member) return null

  // Render logic
  const names = view.pointsName
  const earn = earnPreview(view.cart.subtotalPaise, earnInfoOf(view))
  const worth = showWorth ? pointsWorthPaise(earn, view) : 0
  const earnText = `${copy.points(earn, names)}${worth ? ` ${copy.product.worth(formatPaise(worth))}` : ''}`
  const member = view.member
  const shell =
    'kl-cart-box mb-3 w-full overflow-hidden rounded-[0.5rem] border border-(--kl-line) bg-(--kl-surface) text-left font-sans text-[0.875rem] normal-case tracking-normal text-(--kl-ink)'
  if (!member) {
    if (earn <= 0) return null
    return (
      <div className={`${shell} flex items-center gap-3 px-3.5 py-2.5`}>
        <LoyaltyIcon name="award" className="size-8 shrink-0" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold">{copy.cartBox.guestHead(earnText)}</span>
          <a href={LOGIN} className={`${ACCENT_LINK} text-[0.8125rem]! font-normal!`}>
            {copy.cartBox.guestSub}
          </a>
        </span>
      </div>
    )
  }
  const rows = cartRewardRows(view.rewards, {
    points: member.points,
    subtotalPaise: view.cart.subtotalPaise,
    productIds: view.cart.productIds,
  })
  const applied = view.cart.discountCode
  return (
    <div className={shell}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? copy.cartBox.hide : copy.cartBox.show}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-3 border-0! bg-transparent! px-3.5! py-2.5! text-left text-(--kl-ink)! shadow-none! normal-case! tracking-normal!"
      >
        <LoyaltyIcon name="award" className="size-8 shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[0.875rem] font-semibold">
            {copy.cartBox.memberHead(copy.points(member.points, names))}
          </span>
          <span className="text-[0.8125rem] font-normal text-(--kl-muted)">
            {earn > 0 ? copy.cartBox.memberSub(earnText) : copy.cartBox.memberNoEarn}
          </span>
        </span>
        <LoyaltyIcon name={open ? 'chevron-up' : 'chevron-down'} className="size-5 shrink-0" />
      </button>
      {open ? (
        <div className="flex flex-col border-t border-(--kl-line)">
          {applied ? (
            <p className="m-0 flex items-center gap-2 px-3.5 py-2.5 text-[0.8125rem] text-(--kl-success)">
              <LoyaltyIcon name="check" className="size-4 shrink-0" />
              {copy.cartBox.applied(applied)}
            </p>
          ) : null}
          {rows.length === 0 ? (
            <p className="m-0 px-3.5 py-3 text-[0.8125rem] text-(--kl-muted)">
              {copy.cartBox.none}
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {rows.map(({ reward: r, ok, why }) => {
                const chosen = picked === r.id
                return (
                  <li key={r.id} className="border-t border-(--kl-line) first:border-t-0">
                    <button
                      type="button"
                      disabled={!ok || busy}
                      aria-pressed={chosen}
                      onClick={() => setPicked(chosen ? null : r.id)}
                      className={`flex w-full items-center gap-3 border-0! px-3.5! py-2.5! text-left shadow-none! normal-case! tracking-normal! ${chosen ? 'bg-(--kl-soft)!' : 'bg-transparent!'} ${ok ? 'cursor-pointer text-(--kl-ink)!' : 'cursor-default text-(--kl-muted)!'}`}
                    >
                      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-(--kl-line)">
                        <LoyaltyIcon name="tag" className="size-4" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[0.875rem] font-medium">{r.title}</span>
                        {!ok && why ? (
                          <span className="text-[0.75rem]">
                            {why === 'min_order' && r.minOrderPaise
                              ? copy.cartBox.minOrder(formatPaise(r.minOrderPaise))
                              : (copy.cartBox.why[why] ?? '')}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-[0.8125rem] text-(--kl-muted)">
                        {copy.cartBox.cost(copy.points(rewardCost(r), names))}
                      </span>
                    </button>
                    {chosen && ok ? (
                      <div className="px-3.5 pb-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleRedeem(r)}
                          className={`${DARK_BUTTON} w-full`}
                        >
                          {busy ? copy.cartBox.applying : copy.cartBox.redeem}
                        </button>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
          {failed ? (
            <p role="alert" className="m-0 px-3.5 pb-3 text-[0.8125rem] text-(--kl-danger)">
              {copy.cartBox.failed}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
