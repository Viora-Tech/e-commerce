'use client'

import type { CSSProperties } from 'react'
import { loyaltyLandingContent as page } from '../../data/loyalty-landing'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import LoyaltyCard from './loyalty-card'
import LoyaltyEarnList from './loyalty-earn-list'
import LoyaltyIcon, { type LoyaltyGlyph } from './loyalty-icon'
import LoyaltyJoin from './loyalty-join'
import LoyaltyReferralCard from './loyalty-referral-card'
import LoyaltyRewardList from './loyalty-reward-list'
import { loyaltyStyleVars, programTitle, resolveLoyaltyWidgetSettings } from './loyalty-settings'
import { ACCENT_LINK, CARD_HEADING } from './loyalty-styles'
import type { LoyaltyView } from './loyalty-types'

type LoyaltyLandingProps = {
  view: LoyaltyView
  /** The store's brand colour (the page's header and icons). */
  brand: string | null
  /** Months until points run out (0 never), for the FAQ. */
  expiryMonths: number
}

const SECTION_TITLE =
  'm-0 font-[inherit] text-[1.25rem]! font-bold! leading-tight! tracking-normal! normal-case! text-(--kl-ink)!'

/**
 * The Loyalty landing page (Essential Loyalty's "Loyalty landing page", at `/pages/rewards`): a
 * header on the brand colour with the program name and Join now (or the member's balance), how
 * it works in three steps, the ways to earn and to redeem (the widget's own lists), the referral
 * program when it runs, and a short FAQ. Drawn on a light surface so it reads on any theme.
 */
export default function LoyaltyLanding({ view, brand, expiryMonths }: LoyaltyLandingProps) {
  // Render logic
  const settings = resolveLoyaltyWidgetSettings({}, brand)
  const title = programTitle(settings, view.storeName)
  const member = view.member
  const faq = [...page.faq.items, page.faq.expiry(expiryMonths)]
  return (
    // `data-reveal`: imported themes hide h1-h3 until they scroll in; this page shows them at once.
    <div
      data-reveal
      className="kl-loyalty my-8 flex w-full flex-col gap-6 rounded-[1.25rem] bg-(--kl-soft) p-4 text-left font-sans text-[0.9375rem] normal-case tracking-normal text-(--kl-ink) sm:p-6"
      style={loyaltyStyleVars(settings) as CSSProperties}
    >
      <section className="flex flex-col items-center gap-4 rounded-[1rem] bg-(image:--kl-head) bg-(--kl-head-solid) px-6 py-10 text-center text-(--kl-head-text)">
        <LoyaltyIcon name="gift" className="size-10" />
        <h1 className="m-0 font-[inherit] text-[2rem]! font-bold! leading-tight! tracking-normal! normal-case! text-(--kl-head-text)!">
          {title}
        </h1>
        <p className="m-0 max-w-[32rem] text-[1rem] opacity-90">
          {member ? page.memberLine(copy.points(member.points, view.pointsName)) : page.heroLine}
        </p>
        {member ? (
          <a
            href="/account/points"
            className="inline-flex h-10 items-center rounded-[0.375rem]! bg-white! px-6! font-semibold! text-(--kl-ink)! no-underline!"
          >
            {page.seeMine}
          </a>
        ) : (
          <div className="rounded-[0.75rem] bg-(--kl-surface) px-6 py-4 text-(--kl-ink)">
            <LoyaltyJoin returnTo="/pages/rewards" />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className={SECTION_TITLE}>{page.how.title}</h2>
        <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-3">
          {page.how.steps.map((s, i) => (
            <li key={s.title}>
              <LoyaltyCard>
                <div className="flex flex-col items-center gap-2 text-center">
                  <LoyaltyIcon
                    name={s.icon as LoyaltyGlyph}
                    className="size-9 text-(--kl-accent)"
                  />
                  <h3 className={CARD_HEADING}>{`${i + 1}. ${s.title}`}</h3>
                  <p className="m-0 text-[0.875rem] text-(--kl-muted)">{s.body}</p>
                </div>
              </LoyaltyCard>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {view.waysToEarn.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className={SECTION_TITLE}>{page.earnTitle}</h2>
            <LoyaltyEarnList
              ways={view.waysToEarn}
              names={view.pointsName}
              interactive={false}
              heading={false}
            />
          </section>
        ) : null}
        {view.rewards.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className={SECTION_TITLE}>{page.redeemTitle}</h2>
            <LoyaltyRewardList
              title=""
              rewards={view.rewards}
              names={view.pointsName}
              points={member ? member.points : null}
              onClaimed={null}
            />
          </section>
        ) : null}
      </div>

      {view.referral ? (
        <section className="flex flex-col gap-4">
          <h2 className={SECTION_TITLE}>{page.referTitle}</h2>
          <LoyaltyReferralCard
            referral={view.referral}
            names={view.pointsName}
            storeName={view.storeName}
          />
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className={SECTION_TITLE}>{page.faq.title}</h2>
        <LoyaltyCard>
          <div className="-my-2 flex flex-col">
            {faq.map((f) => (
              <details
                key={f.q}
                className="group border-t border-(--kl-line) py-3 first:border-t-0"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-(--kl-ink)">
                  {f.q}
                  <LoyaltyIcon
                    name="chevron-down"
                    className="size-4 shrink-0 transition-[rotate] duration-150 group-open:rotate-180"
                  />
                </summary>
                <p className="m-0 pt-2 text-[0.875rem] leading-normal text-(--kl-muted)">{f.a}</p>
              </details>
            ))}
          </div>
        </LoyaltyCard>
        {member ? null : (
          <p className="m-0 text-center text-[0.875rem] text-(--kl-muted)">
            {copy.guest.haveAccount}{' '}
            <a href="/account/login?return_to=%2Fpages%2Frewards" className={ACCENT_LINK}>
              {copy.guest.signIn}
            </a>
          </p>
        )}
      </section>
    </div>
  )
}
