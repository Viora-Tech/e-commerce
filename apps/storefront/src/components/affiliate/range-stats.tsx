import { formatPaise } from '@commerce/blocks'
import {
  PORTAL_RANGES,
  type PortalRange,
  type PortalStats,
} from '@commerce/plugin-affiliates/server'
import Link from 'next/link'
import { affiliateContent } from '@/data/affiliate'

type RangeStatsProps = { range: PortalRange; stats: PortalStats }

const copy = affiliateContent.dashboard

/** Clicks, orders, conversion, sales and earnings for 7, 30 or 90 days, or all time. */
export default function RangeStats({ range, stats: s }: RangeStatsProps) {
  // Render logic
  const tiles = [
    { label: copy.stats.clicks, value: String(s.clicks), wide: false },
    { label: copy.stats.orders, value: String(s.orders), wide: false },
    {
      label: copy.stats.conversion,
      value: s.conversion === null ? copy.stats.none : `${s.conversion}%`,
      wide: false,
    },
    { label: copy.stats.sales, value: formatPaise(s.salesPaise), wide: false },
    { label: copy.stats.earned, value: formatPaise(s.earnedPaise), wide: true },
  ]

  return (
    <section className="flex flex-col gap-3">
      <nav aria-label={copy.range.label} className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {PORTAL_RANGES.map((r) => {
          const on = r === range
          return (
            <Link
              key={r}
              href={`?range=${r}`}
              scroll={false}
              aria-current={on ? 'true' : undefined}
              className={`shrink-0 rounded-full px-3 py-1.5 text-small whitespace-nowrap ${
                on ? 'bg-ink! text-bg!' : 'text-muted hover:bg-surface'
              }`}
            >
              {copy.range.options[r]}
            </Link>
          )
        })}
      </nav>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div
            key={t.label}
            className={`flex flex-col gap-1 rounded-[var(--radius-card)] bg-surface p-4 ${
              t.wide ? 'col-span-2 sm:col-span-1' : ''
            }`}
          >
            <dt className="text-small text-muted">{t.label}</dt>
            <dd className="h4 tabular-nums">{t.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
