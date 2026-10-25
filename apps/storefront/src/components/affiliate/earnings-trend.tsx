import { formatPaise } from '@commerce/blocks'
import { formatInZone } from '@commerce/dates'
import { conversionPercent } from '@commerce/plugin-affiliates/settings'
import { affiliateContent } from '@/data/affiliate'

type EarningsTrendProps = {
  points: { period: string; orders: number; commissionPaise: number; clicks: number }[]
}

const copy = affiliateContent.dashboard.trend

/** Their last 12 months as bars of what they earned, with clicks, orders and conversion. */
export default function EarningsTrend({ points }: EarningsTrendProps) {
  // Render logic
  const max = Math.max(1, ...points.map((p) => p.commissionPaise))
  const clicks = points.reduce((s, p) => s + p.clicks, 0)
  const orders = points.reduce((s, p) => s + p.orders, 0)
  const conversion = conversionPercent(orders, clicks)

  return (
    <section className="flex max-w-[48rem] flex-col gap-3">
      <h2 className="h3">{copy.title}</h2>
      {points.length === 0 ? (
        <p className="text-body text-muted">{copy.empty}</p>
      ) : (
        <>
          <ol className="flex h-36 items-end gap-2" aria-label={copy.title}>
            {points.map((p) => (
              <li key={p.period} className="flex flex-1 flex-col items-center gap-1">
                <span
                  className="w-full rounded-t-sm bg-[var(--color-accent,currentColor)] opacity-80"
                  style={{ height: `${Math.max(2, (p.commissionPaise / max) * 100)}%` }}
                  title={`${copy.earned}: ${formatPaise(p.commissionPaise)} · ${copy.orders}: ${p.orders} · ${copy.clicks}: ${p.clicks}`}
                />
                <span className="text-[0.625rem] text-muted">
                  {formatInZone(new Date(`${p.period}T00:00:00+05:30`), { month: 'short' })}
                </span>
              </li>
            ))}
          </ol>
          {conversion !== null ? (
            <p className="text-small text-muted">{copy.conversion(conversion)}</p>
          ) : null}
        </>
      )}
    </section>
  )
}
