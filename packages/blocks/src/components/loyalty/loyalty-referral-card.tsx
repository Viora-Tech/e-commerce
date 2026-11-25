'use client'

import { useState } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import LoyaltyCard from './loyalty-card'
import { offerLabel } from './loyalty-format'
import LoyaltyIcon from './loyalty-icon'
import { shareNetworksOf, shareUrl } from './loyalty-share'
import { ACCENT_BUTTON, ICON_TILE } from './loyalty-styles'
import type { LoyaltyPointsName, LoyaltyReferralView } from './loyalty-types'

type LoyaltyReferralCardProps = {
  referral: LoyaltyReferralView
  names: LoyaltyPointsName
  storeName: string
}

/**
 * "Refer a friend", Essential Loyalty's way: two tiles side by side, what the friend gets
 * ("They get 10% off") and what the member gets ("You get 100 points"). A member then has their
 * own link with Copy and a share button per network the merchant chose (Loyalty → Referrals);
 * a visitor is told to join for a link.
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
  const tiles = [
    { key: 'give', label: copy.referral.give, value: friend, icon: 'gift' as const },
    ...(referral.referrerReward
      ? [
          {
            key: 'get',
            label: copy.referral.get,
            value: offerLabel(referral.referrerReward, names),
            icon: 'coins' as const,
          },
        ]
      : []),
  ]
  return (
    <LoyaltyCard title={copy.referral.title} intro={copy.referral.intro}>
      <div className={`grid gap-2 ${tiles.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {tiles.map((t) => (
          <div
            key={t.key}
            className="flex flex-col items-start gap-2 rounded-xl border border-(--kl-line) bg-(--kl-soft) p-3"
          >
            <span className={ICON_TILE}>
              <LoyaltyIcon name={t.icon} className="size-5" />
            </span>
            <span className="text-[0.75rem] font-semibold tracking-wide text-(--kl-muted) uppercase">
              {t.label}
            </span>
            <span className="font-bold leading-tight text-(--kl-ink)">{t.value}</span>
          </div>
        ))}
      </div>
      {share ? (
        <>
          <span className="flex items-center gap-2">
            <input
              readOnly
              value={share.url}
              aria-label={copy.referral.yourLink}
              onFocus={(e) => e.currentTarget.select()}
              className="h-11 min-w-0 flex-1 rounded-xl border border-(--kl-line) bg-(--kl-surface) px-3 text-[0.8125rem] text-(--kl-ink)"
            />
            <button type="button" onClick={handleCopy} className={`${ACCENT_BUTTON} shrink-0 px-4`}>
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
                  className="inline-flex items-center gap-1.5 rounded-full border border-(--kl-line) px-3 py-1.5 text-[0.8125rem] font-semibold text-(--kl-ink) no-underline hover:bg-(--kl-soft)"
                >
                  <LoyaltyIcon name="share" className="size-3.5" />
                  {copy.referral.networks[n] ?? n}
                </a>
              ))}
            </span>
          ) : null}
        </>
      ) : (
        <p className="m-0 text-[0.8125rem] text-(--kl-muted)">{copy.referral.joinForLink}</p>
      )}
      {referral.completed > 0 ? (
        <span className="text-[0.8125rem] text-(--kl-muted)">
          {copy.referral.done(referral.completed)}
        </span>
      ) : null}
    </LoyaltyCard>
  )
}
