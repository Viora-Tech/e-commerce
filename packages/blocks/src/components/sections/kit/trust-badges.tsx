// Pattern after common store trust bars (our own implementation). See THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import Icon, { isIconName } from '../../icon'

/** Copy is a string in storage, a React node while edited on the canvas (icons stay strings). */
type TrustBadgesProps = {
  badges: { icon: string; title: ReactNode; text: ReactNode }[]
}

/** A slim band of reassurances (shipping, payments, returns) split by hairlines. */
export default function TrustBadges({ badges }: TrustBadgesProps) {
  // Early returns
  if (!badges?.length) return null

  // Render logic
  return (
    <div className="page-width">
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-line)] lg:grid-cols-4">
        {badges.map((badge, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
            key={i}
            className="flex items-center gap-[0.875rem] bg-[var(--color-bg)] p-[1.25rem] text-left"
          >
            {isIconName(badge.icon) ? (
              <span className="flex size-[2.5rem] shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-brand)_12%,transparent)] text-[var(--color-brand)]">
                <Icon name={badge.icon} size={20} />
              </span>
            ) : null}
            <span className="flex min-w-0 flex-col">
              <span className="text-small font-semibold text-[var(--color-ink)]">
                {badge.title}
              </span>
              {badge.text ? (
                <span className="text-caption text-[var(--color-muted)]">{badge.text}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
