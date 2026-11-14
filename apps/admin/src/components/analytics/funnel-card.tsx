import type { AnalyticsOverview } from '@commerce/api'
import KitProgress from '@/components/kit/kit-progress'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { analyticsContent as copy } from '@/data/analytics'
import { formatRate } from '@/lib/analytics-range'
import { formatCompact } from '@/lib/money'

type FunnelCardProps = { steps: AnalyticsOverview['funnel'] }

/** Sessions to orders, each step against sessions with its drop from the step before. */
export default function FunnelCard({ steps }: FunnelCardProps) {
  // Render logic
  const c = copy.funnel
  const empty = steps.every((s) => s.value === 0)
  /* Bars are a share of the widest step, which is sessions once the beacon has traffic. */
  const widest = Math.max(...steps.map((s) => s.value))
  const shareLabel = steps[0]?.value === widest ? c.ofSessions : c.ofPeak

  return (
    <DataCard title={c.title}>
      {empty ? (
        <EmptyState variant="inline" body={c.help} />
      ) : (
        <ul className="flex flex-col gap-5">
          {steps.map((step) => (
            <li key={step.id} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-body font-medium text-foreground">{c.steps[step.id]}</span>
                <span className="text-body text-ink-strong tabular-nums">
                  {formatCompact(step.value)}
                </span>
              </div>
              <KitProgress value={step.share} />
              <div className="flex items-baseline justify-between gap-3 text-period text-muted-foreground-soft">
                <span>
                  {formatRate(step.share)} {shareLabel}
                </span>
                {step.stepRate === null ? null : (
                  <span>
                    {formatRate(step.stepRate)} {c.fromPrevious}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
