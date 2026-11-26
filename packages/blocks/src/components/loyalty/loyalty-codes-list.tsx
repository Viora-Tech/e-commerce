'use client'

import { useState } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import LoyaltyCard from './loyalty-card'
import { dayLabel } from './loyalty-format'
import LoyaltyIcon from './loyalty-icon'
import { ICON_BUTTON } from './loyalty-styles'
import type { LoyaltyCodeView } from './loyalty-types'

type LoyaltyCodesListProps = {
  codes: LoyaltyCodeView[]
  /** False inside the panel's "My discounts" screen, whose header already names it. */
  heading?: boolean | undefined
}

/**
 * "My discounts": every code the member claimed (rewards, tier and referral gifts): a ticket in
 * the brand colour, the reward, the code with a copy button while it can be used, and its state
 * and last day. One short line while there are none.
 */
export default function LoyaltyCodesList({ codes, heading = true }: LoyaltyCodesListProps) {
  // Hooks
  const [copied, setCopied] = useState<string | null>(null)

  // Event handlers
  const handleCopy = async (c: LoyaltyCodeView) => {
    if (!c.code) return
    try {
      await navigator.clipboard.writeText(c.code)
      setCopied(c.id)
    } catch {
      setCopied(null)
    }
  }

  // Render logic
  return (
    <LoyaltyCard title={heading ? copy.codes.title : undefined}>
      {codes.length === 0 ? (
        <p className="m-0 flex items-center gap-3 text-[0.875rem] text-(--kl-muted)">
          <LoyaltyIcon name="ticket" className="size-6 shrink-0 text-(--kl-accent)" />
          {copy.codes.empty}
        </p>
      ) : (
        <ul className="m-0 -my-2 flex list-none flex-col p-0">
          {codes.map((c) => {
            const usable = c.status === 'issued'
            return (
              <li
                key={c.id}
                className="flex items-center gap-3 border-t border-(--kl-line) py-3 first:border-t-0"
              >
                <LoyaltyIcon
                  name="ticket"
                  className={`size-6 shrink-0 self-start ${usable ? 'text-(--kl-accent)' : 'text-(--kl-muted)'}`}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[0.875rem] font-semibold text-(--kl-ink)">{c.title}</span>
                  {c.code ? (
                    <code className="truncate font-mono text-[0.8125rem] text-(--kl-ink)">
                      {c.code}
                    </code>
                  ) : null}
                  <span
                    className={`text-[0.75rem] ${usable ? 'text-(--kl-success)' : 'text-(--kl-muted)'}`}
                  >
                    {copy.codes.status[c.status] ?? c.status}
                    {c.expiresAt && usable ? ` · ${copy.code.until(dayLabel(c.expiresAt))}` : ''}
                  </span>
                </span>
                {c.code && usable ? (
                  <button
                    type="button"
                    onClick={() => handleCopy(c)}
                    aria-label={`${copy.code.copy} ${c.code}`}
                    className={`${ICON_BUTTON} text-(--kl-ink)`}
                  >
                    <LoyaltyIcon name={copied === c.id ? 'check' : 'copy'} className="size-4" />
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </LoyaltyCard>
  )
}
