import { returnTimeline } from '@commerce/core/returns'
import DataCard from '@/components/layout/data-card'
import Timeline from '@/components/layout/timeline'
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
      <Timeline
        variant="steps"
        items={steps.map((s) => ({
          id: s.key,
          title: labels[s.key],
          time: s.done && s.at ? formatWhen(s.at) : copy.pending,
          tone: !s.done ? 'pending' : s.key === 'rejected' ? 'danger' : 'success',
        }))}
      />
    </DataCard>
  )
}
