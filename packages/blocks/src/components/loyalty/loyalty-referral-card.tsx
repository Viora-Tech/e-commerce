'use client'

import { useState } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { offerLabel } from './loyalty-format'
import { shareNetworksOf, shareUrl } from './loyalty-share'
import type { LoyaltyPointsName, LoyaltyReferralView } from './loyalty-types'

type LoyaltyReferralCardProps = {
  referral: LoyaltyReferralView
  names: LoyaltyPointsName
  storeName: string
}

/**
 * The referral program for a member: what they and their friend get, their own link with Copy,
 * and a share button per network the merchant chose (Loyalty → Referrals, share buttons).
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
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-(--kl-line) p-4">
      <h3 className="m-0 text-[1rem] font-bold text-(--kl-ink)">{copy.referral.title}</h3>
      <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-[0.875rem] text-(--kl-ink)">
        {referral.referrerReward ? (
          <li>{copy.referral.you(offerLabel(referral.referrerReward, names))}</li>
        ) : null}
        <li>{copy.referral.friend(friend)}</li>
      </ul>
      {share ? (
        <>
          <span className="text-[0.8125rem] font-medium text-(--kl-muted)">
            {copy.referral.yourLink}
          </span>
          <span className="flex items-center gap-2">
            <input
              readOnly
              value={share.url}
              aria-label={copy.referral.yourLink}
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-md border border-(--kl-line) bg-(--kl-surface) px-3 text-[0.8125rem] text-(--kl-ink)"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="h-10 shrink-0 rounded-full border border-(--kl-line) bg-(--kl-surface) px-3 text-[0.8125rem] font-semibold text-(--kl-ink)"
            >
              {copied ? copy.referral.copied : copy.referral.copy}
            </button>
          </span>
          {networks.length > 0 ? (
            <span className="flex flex-wrap gap-2">
              {networks.map((n) => (
                <a
                  key={n}
                  href={shareUrl(n, share)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-(--kl-line) px-3 py-1.5 text-[0.8125rem] font-semibold text-(--kl-ink) no-underline"
                >
                  {copy.referral.networks[n] ?? n}
                </a>
              ))}
            </span>
          ) : null}
        </>
      ) : null}
      {referral.completed > 0 ? (
        <span className="text-[0.8125rem] text-(--kl-muted)">
          {copy.referral.done(referral.completed)}
        </span>
      ) : null}
    </section>
  )
}
