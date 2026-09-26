import { returnTimeline } from '@commerce/core/returns'
import { cn } from '@commerce/ui/lib/utils'
import DataCard from '@/components/layout/data-card'
import { returnDetailContent as copy } from '@/data/returns'
import { formatWhen } from '@/lib/format-date'
import type { ReturnDetail } from './return-types'

type ReturnTimelineCardProps = { detail: ReturnDetail }

const asDate = (v: Date | string | null): Date | null => (v ? new Date(v) : null)

/** Where the return stands: each step done (with its time) or still ahead. */
export default function ReturnTimelineCard({ detail: r }: ReturnTimelineCardProps) {
  // Render logic
  const steps = returnTimeline({
    status: r.status,
    kind: r.kind,
    pickupMethod: r.pickupMethod,
    requestedAt: new Date(r.requestedAt),
    approvedAt: asDate(r.approvedAt),
    rejectedAt: asDate(r.rejectedAt),
    pickupArrangedAt: asDate(r.pickupArrangedAt),
    receivedAt: asDate(r.receivedAt),
    resolvedAt: asDate(r.resolvedAt),
  })
  const labels = r.kind === 'rto' ? { ...copy.steps, ...copy.rtoSteps } : copy.steps

  return (
    <DataCard title={copy.timeline}>
      <ol className="flex flex-col gap-3">
        {steps.map((s) => (
          <li key={s.key} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={cn(
                'mt-1.5 size-2.5 shrink-0 rounded-full',
                !s.done && 'border border-border-strong bg-card',
                s.done && (s.key === 'rejected' ? 'bg-danger' : 'bg-success'),
              )}
            />
            <span className="flex flex-col">
              <span
                className={cn('text-body', s.done ? 'text-foreground' : 'text-muted-foreground')}
              >
                {labels[s.key]}
              </span>
              <span className="text-caption text-muted-foreground">
                {s.done && s.at ? formatWhen(s.at) : copy.pending}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </DataCard>
  )
}
