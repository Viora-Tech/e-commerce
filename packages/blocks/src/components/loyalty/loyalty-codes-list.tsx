import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { dayLabel } from './loyalty-format'
import type { LoyaltyCodeView } from './loyalty-types'

type LoyaltyCodesListProps = { codes: LoyaltyCodeView[] }

/** "My discounts": every code the member claimed (rewards, tier and referral gifts), with its state and last day. */
export default function LoyaltyCodesList({ codes }: LoyaltyCodesListProps) {
  // Render logic
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-(--kl-line) p-4">
      <h3 className="m-0 text-[1rem] font-bold text-(--kl-ink)">{copy.codes.title}</h3>
      {codes.length === 0 ? (
        <p className="m-0 text-[0.875rem] text-(--kl-muted)">{copy.codes.empty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {codes.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 border-t border-(--kl-line) py-2.5 first:border-t-0"
            >
              <span className="flex min-w-0 flex-col">
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
    </section>
  )
}
