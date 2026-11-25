import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import LoyaltyCard from './loyalty-card'
import { dayLabel, rewardGlyph } from './loyalty-format'
import LoyaltyIcon from './loyalty-icon'
import { ICON_TILE } from './loyalty-styles'
import type { LoyaltyCodeView } from './loyalty-types'

type LoyaltyCodesListProps = { codes: LoyaltyCodeView[] }

/**
 * "Your rewards": every code the member claimed (rewards, tier and referral gifts) with its icon,
 * state and last day; one short line with an icon while there are none.
 */
export default function LoyaltyCodesList({ codes }: LoyaltyCodesListProps) {
  // Render logic
  return (
    <LoyaltyCard title={copy.codes.title}>
      {codes.length === 0 ? (
        <p className="m-0 flex items-center gap-3 text-[0.875rem] text-(--kl-muted)">
          <span className={ICON_TILE}>
            <LoyaltyIcon name="tag" className="size-5" />
          </span>
          {copy.codes.empty}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {codes.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 border-t border-(--kl-line) py-2.5 first:border-t-0"
            >
              <span className={ICON_TILE}>
                <LoyaltyIcon name={rewardGlyph(c.rewardType)} className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium text-(--kl-ink)">{c.title}</span>
                {c.code ? (
                  <code className="font-mono text-[0.8125rem] text-(--kl-ink)">{c.code}</code>
                ) : null}
                {c.expiresAt && c.status === 'issued' ? (
                  <span className="text-[0.8125rem] text-(--kl-muted)">
                    {copy.code.until(dayLabel(c.expiresAt))}
                  </span>
                ) : null}
              </span>
              <span
                className={`shrink-0 text-[0.8125rem] font-semibold ${c.status === 'issued' ? 'text-(--kl-success)' : 'text-(--kl-muted)'}`}
              >
                {copy.codes.status[c.status] ?? c.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </LoyaltyCard>
  )
}
