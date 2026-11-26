'use client'

import { useState } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import LoyaltyCard from './loyalty-card'
import { offerLabel } from './loyalty-format'
import LoyaltyIcon from './loyalty-icon'
import { shareNetworksOf, shareUrl } from './loyalty-share'
import { ICON_BUTTON } from './loyalty-styles'
import type { LoyaltyPointsName, LoyaltyReferralView } from './loyalty-types'

type LoyaltyReferralCardProps = {
  referral: LoyaltyReferralView
  names: LoyaltyPointsName
  storeName: string
}

/**
 * "Refer a friend", Essential Loyalty's way: a centred line, then "You get" and "Your friend
 * gets" rows with a percent badge in the brand colour. A member then has "Your link": the link in
 * a read-only field with a copy button inside it, and one row of share icon buttons (the networks
 * the merchant chose, Loyalty → Referrals). A visitor is told to join for a link.
 */
export default function LoyaltyReferralCard({
  referral,
  names,
  storeName,
}: LoyaltyReferralCardProps) {
  // Hooks
  const [copied, setCopied] = useState(false)

  // Event handlers
  const handleCopy = async () => {
    if (!referral.url) return
    try {
      await navigator.clipboard.writeText(referral.url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  // Render logic
  const friend = offerLabel(referral.friendReward, names)
  const networks = shareNetworksOf(referral.shareChannels)
  const share = referral.url
    ? {
        url: referral.url,
        text: copy.referral.shareText(storeName, friend),
        subject: copy.referral.shareSubject(storeName),
      }
    : null
  const rows = [
    ...(referral.referrerReward
      ? [
          {
            key: 'get',
            label: copy.referral.get,
            value: offerLabel(referral.referrerReward, names),
          },
        ]
      : []),
    { key: 'give', label: copy.referral.give, value: friend },
  ]
  return (
    <LoyaltyCard title={copy.referral.title} intro={copy.referral.intro}>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3">
            <LoyaltyIcon name="percent" className="size-6 shrink-0 text-(--kl-accent)" />
            <span className="flex min-w-0 flex-col">
              <span className="text-[0.875rem] font-semibold text-(--kl-ink)">{r.label}</span>
              <span className="text-[0.8125rem] text-(--kl-muted)">{r.value}</span>
            </span>
          </li>
        ))}
      </ul>
      {share ? (
        <div className="flex flex-col gap-3 border-t border-(--kl-line) pt-3">
          <span className="text-center text-[0.875rem] font-semibold text-(--kl-ink)">
            {copy.referral.yourLink}
          </span>
          <span className="flex h-10 items-center gap-1 rounded-[0.5rem] border border-(--kl-line) bg-(--kl-surface) pr-1 pl-3">
            <input
              readOnly
              value={share.url}
              aria-label={copy.referral.yourLink}
              onFocus={(e) => e.currentTarget.select()}
              className="m-0! h-full min-w-0 flex-1 border-0! bg-transparent! p-0! text-[0.8125rem]! text-(--kl-ink)! shadow-none! outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? copy.referral.copied : copy.referral.copy}
              title={copied ? copy.referral.copied : copy.referral.copy}
              className={`${ICON_BUTTON} text-(--kl-ink)`}
            >
              <LoyaltyIcon name={copied ? 'check' : 'copy'} className="size-4" />
            </button>
          </span>
          {copied ? (
            <span role="status" className="text-center text-[0.75rem] text-(--kl-success)">
              {copy.referral.copied}
            </span>
          ) : null}
          {networks.length > 0 ? (
            <span className="flex items-center justify-center gap-2">
              {networks.map((n) => {
                const label = copy.referral.shareOn(copy.referral.networks[n] ?? n)
                return (
                  <a
                    key={n}
                    href={shareUrl(n, share)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className={`${ICON_BUTTON} size-9! text-(--kl-ink)!`}
                  >
                    <LoyaltyIcon name={n} className="size-5" />
                  </a>
                )
              })}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="m-0 border-t border-(--kl-line) pt-3 text-center text-[0.8125rem] text-(--kl-muted)">
          {copy.referral.joinForLink}
        </p>
      )}
      {referral.completed > 0 ? (
        <span className="text-center text-[0.8125rem] text-(--kl-muted)">
          {copy.referral.done(referral.completed)}
        </span>
      ) : null}
    </LoyaltyCard>
  )
}
