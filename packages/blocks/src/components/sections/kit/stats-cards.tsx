// Numbers count up with the shared effect adapted from Magic UI Number Ticker (MIT),
// `../../../effects/number-ticker`. Card layout is our own. See THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import NumberTicker from '../../../effects/number-ticker'

/** Copy is a string in storage, a React node while edited on the canvas. */
type StatsCardsProps = {
  heading: ReactNode
  stats: {
    value: number
    prefix: ReactNode
    suffix: ReactNode
    label: ReactNode
    detail: ReactNode
  }[]
}

/** Up to four headline numbers, each in its own card with a label and a quiet detail line. */
export default function StatsCards({ heading, stats }: StatsCardsProps) {
  // Early returns
  if (!stats?.length) return null

  // Render logic
  return (
    <div className="page-width flex flex-col gap-[2rem]">
      {heading ? <h2 className="h2 text-center text-[var(--color-ink)]">{heading}</h2> : null}
      <div className="grid grid-cols-1 gap-[1rem] sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
            key={i}
            className="flex flex-col gap-[0.5rem] rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-[1.5rem]"
          >
            <NumberTicker
              value={Number(stat.value) || 0}
              prefix={stat.prefix}
              suffix={stat.suffix}
              className="h2 tabular-nums text-[var(--color-ink)]"
            />
            {stat.label ? (
              <p className="text-body font-semibold text-[var(--color-ink)]">{stat.label}</p>
            ) : null}
            {stat.detail ? (
              <p className="text-small text-[var(--color-muted)]">{stat.detail}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
