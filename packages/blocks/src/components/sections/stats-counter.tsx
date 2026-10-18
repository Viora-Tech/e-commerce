// Adapted from Magic UI's Number Ticker (MIT): the shared effect in `../../effects/number-ticker`.
// See THIRD_PARTY_NOTICES.md and packages/blocks/THIRD_PARTY_LICENSES.md.
import type { ReactNode } from 'react'
import NumberTicker from '../../effects/number-ticker'

/** Copy is a string in storage, a React node while edited on the canvas. */
type Stat = { value: number; prefix: ReactNode; suffix: ReactNode; label: ReactNode }

type StatsCounterProps = { heading: ReactNode; stats: Stat[] }

// Figma Section / Stats counter (707:118716): outlined cards, a 48px bold figure over a small
// muted label. Each number counts up when scrolled into view; reduced motion (and any environment without
// IntersectionObserver, e.g. the admin's static preview render) shows the final value at once.
export default function StatsCounter({ heading, stats }: StatsCounterProps) {
  // Early returns
  if (stats.length === 0) return null

  return (
    <div className="stats-counter page-width">
      {heading ? <h2 className="stats-counter__heading">{heading}</h2> : null}
      <div className="stats-counter__grid">
        {stats.map((stat, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
          <div key={i} className="stats-counter__card">
            <NumberTicker
              value={stat.value}
              prefix={stat.prefix}
              suffix={stat.suffix}
              className="stats-counter__value"
            />
            {stat.label ? <p className="stats-counter__label">{stat.label}</p> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
