'use client'

import { useState } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { claimWayToEarn } from './loyalty-client'
import { wayPoints, wayTitle } from './loyalty-format'
import type { LoyaltyPointsName, LoyaltyWayToEarn } from './loyalty-types'

type LoyaltyEarnListProps = {
  ways: LoyaltyWayToEarn[]
  names: LoyaltyPointsName
  /** Signed in: social and review rules get a button that opens the link and credits the points. */
  interactive: boolean
  onChanged?: (() => void) | undefined
}

const CLICK_THROUGH = new Set(['social', 'google_review'])

/**
 * "Ways to earn": each switched-on rule with its points. For a member, a follow or review rule
 * opens its link in a new tab and credits the points on the click (the honour system the
 * program uses); a once-only rule already earned shows Done.
 */
export default function LoyaltyEarnList({
  ways,
  names,
  interactive,
  onChanged,
}: LoyaltyEarnListProps) {
  // Hooks
  const [earned, setEarned] = useState<Record<string, number>>({})

  // Event handlers
  const handleGo = (way: LoyaltyWayToEarn) => {
    // Opened inside the click, so a pop-up blocker lets it through.
    if (way.url) window.open(way.url, '_blank', 'noopener,noreferrer')
    void claimWayToEarn(way.id).then((r) => {
      if (!r) return
      setEarned((e) => ({ ...e, [way.id]: r.points }))
      onChanged?.()
    })
  }

  // Early returns
  if (ways.length === 0) return null

  // Render logic
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-(--kl-line) p-4">
      <h3 className="m-0 text-[1rem] font-bold text-(--kl-ink)">{copy.earn.title}</h3>
      <ul className="m-0 flex list-none flex-col p-0">
        {ways.map((w) => {
          const got = earned[w.id]
          const done = w.claimed || got !== undefined
          const canGo = interactive && CLICK_THROUGH.has(w.type) && !!w.url && !done
          return (
            <li
              key={w.id}
              className="flex items-center justify-between gap-3 border-t border-(--kl-line) py-2.5 first:border-t-0"
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-medium text-(--kl-ink)">{wayTitle(w)}</span>
                <span className="text-[0.8125rem] text-(--kl-muted)">
                  {got ? copy.earn.earned(copy.points(got, names)) : wayPoints(w, names)}
                </span>
              </span>
              {canGo ? (
                <button
                  type="button"
                  onClick={() => handleGo(w)}
                  className="shrink-0 rounded-full border border-(--kl-line) bg-transparent px-3.5 py-1.5 text-[0.8125rem] font-semibold text-(--kl-ink)"
                >
                  {copy.earn.go}
                </button>
              ) : interactive && done && w.onceOnly ? (
                <span className="shrink-0 text-[0.8125rem] font-semibold text-(--kl-success)">
                  {copy.earn.done}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
