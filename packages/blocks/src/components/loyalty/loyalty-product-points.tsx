'use client'

import { useEffect, useState } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { loadEarnInfo } from './loyalty-client'
import LoyaltyIcon from './loyalty-icon'
import { earnPreview } from './loyalty-math'
import type { LoyaltyEarnInfo } from './loyalty-types'

type LoyaltyProductPointsProps = {
  /** The price the line counts from (the product's default variant); null in the editor. */
  pricePaise: number | null
  /** `line` (text under the price) or `card` (a soft box). */
  look: 'line' | 'card'
}

/**
 * The "Points on product" block: "Earn 12 points with this order" from the store's order spend
 * rule and the shopper's tier multiplier; a visitor who is not signed in sees "Join rewards to
 * earn points" (a link to sign in). Read after the page draws, so it never slows the product page.
 */
export default function LoyaltyProductPoints({ pricePaise, look }: LoyaltyProductPointsProps) {
  // Hooks
  const [info, setInfo] = useState<LoyaltyEarnInfo | null>(null)
  useEffect(() => {
    let live = true
    void loadEarnInfo().then((v) => {
      if (live) setInfo(v)
    })
    return () => {
      live = false
    }
  }, [])

  // Early returns
  if (!info?.live || info.pointsPer100 <= 0 || !pricePaise) return null
  if (info.signedIn && !info.open) return null

  // Render logic
  const points = earnPreview(pricePaise, info)
  if (points <= 0) return null
  const box =
    look === 'card'
      ? 'rounded-[var(--radius-m,0.5rem)] border border-line bg-surface px-3 py-2'
      : ''
  return (
    <p className={`m-0 flex items-center gap-2 text-sm text-ink ${box}`}>
      <LoyaltyIcon name="gift" className="size-4 shrink-0" />
      {info.signedIn ? (
        <span>{copy.product.earn(copy.points(points, info.pointsName))}</span>
      ) : (
        <a href="/account/login" className="underline">
          {copy.product.join}
        </a>
      )}
    </p>
  )
}
