'use client'

import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import LoyaltyEarnList from './loyalty-earn-list'
import { offerLabel } from './loyalty-format'
import LoyaltyRewardList from './loyalty-reward-list'
import type { LoyaltyView } from './loyalty-types'

type LoyaltyGuestBodyProps = { view: LoyaltyView }

/** Sign-in path that comes back to this page. */
function signInHref(): string {
  const here = `${window.location.pathname}${window.location.search}`
  return `/account/login?return_to=${encodeURIComponent(here)}`
}

const CARD = 'flex flex-col gap-3 rounded-xl border border-(--kl-line) p-4'
const TITLE = 'm-0 text-[1rem] font-bold text-(--kl-ink)'

/**
 * The panel for a visitor who is not signed in: how to join (signing in creates the account),
 * the ways to earn and redeem, and what a friend gets from a referral.
 */
export default function LoyaltyGuestBody({ view }: LoyaltyGuestBodyProps) {
  // Render logic
  const href = signInHref()
  return (
    <>
      <section className={CARD}>
        <h3 className={TITLE}>{copy.guest.heading}</h3>
        <p className="m-0 text-(--kl-muted)">{copy.guest.body}</p>
        <a
          href={href}
          className="inline-flex h-11 items-center justify-center rounded-full bg-(image:--kl-head) bg-(--kl-head-solid) px-5 font-semibold text-(--kl-head-text) no-underline"
        >
          {copy.guest.join}
        </a>
        <p className="m-0 text-center text-[0.875rem] text-(--kl-muted)">
          {copy.guest.haveAccount}{' '}
          <a href={href} className="font-semibold text-(--kl-ink) underline">
            {copy.guest.signIn}
          </a>
        </p>
      </section>
      <LoyaltyEarnList ways={view.waysToEarn} names={view.pointsName} interactive={false} />
      <LoyaltyRewardList
        title={copy.rewards.redeemTitle}
        rewards={view.rewards}
        names={view.pointsName}
        points={null}
        onClaimed={null}
      />
      {view.referral ? (
        <section className={CARD}>
          <h3 className={TITLE}>{copy.referral.title}</h3>
          <p className="m-0 text-(--kl-muted)">
            {copy.referral.teaser(offerLabel(view.referral.friendReward, view.pointsName))}
          </p>
        </section>
      ) : null}
    </>
  )
}
