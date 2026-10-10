// Adapted from Magic UI's Number Ticker (MIT): the shared effect in `../../effects/number-ticker`.
// See THIRD_PARTY_NOTICES.md and packages/blocks/THIRD_PARTY_LICENSES.md.
import type { ReactNode } from 'react'
import NumberTicker from '../../effects/number-ticker'

/** Copy is a string in storage, a React node while edited on the canvas. */
type Stat = { value: number; prefix: ReactNode; suffix: ReactNode; label: ReactNode }

type StatsCounterProps = { heading: ReactNode; stats: Stat[] }

// Each number counts up when scrolled into view; reduced motion (and any environment without
// IntersectionObserver, e.g. the admin's static preview render) shows the final value at once.
export default function StatsCounter({ heading, stats }: StatsCounterProps) {
  // Early returns
  if (stats.length === 0) return null

  return (
    <div className="page-width">
      {heading ? <h2 className="h2 text-center text-[var(--color-ink)]">{heading}</h2> : null}
      <div className="mt-[1.5rem] grid grid-cols-2 gap-[1.5rem] text-center md:grid-cols-4">
        {stats.map((stat, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
          <div key={i} className="flex flex-col items-center gap-[0.25rem]">
            <NumberTicker
              value={stat.value}
              prefix={stat.prefix}
              suffix={stat.suffix}
              className="h1 text-[var(--color-ink)]"
            />
            {stat.label ? (
              <p className="text-body text-[var(--color-muted)]">{stat.label}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
