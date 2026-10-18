import DataCard from '@/components/layout/data-card'
import Timeline from '@/components/layout/timeline'
import { abandonedDetailContent } from '@/data/abandoned-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { AbandonedCheckout } from './abandoned-detail-types'

const TIME = { hour: 'numeric', minute: '2-digit' } as const

type AbandonedActivityCardProps = {
  checkout: AbandonedCheckout
}

export default function AbandonedActivityCard({ checkout }: AbandonedActivityCardProps) {
  // Hooks
  const content = useCopy(abandonedDetailContent)
  const fmt = useFormat()

  // Render logic
  const copy = content.activity
  const touched = new Date(checkout.updatedAt).getTime()
  const entries = [
    ...(checkout.recovered
      ? [{ id: 'recovered', title: copy.recovered, at: checkout.updatedAt }]
      : []),
    ...(checkout.recoverySentAt
      ? [{ id: 'reminded', title: copy.reminded, at: checkout.recoverySentAt }]
      : []),
    ...(touched - new Date(checkout.createdAt).getTime() > 60_000 && !checkout.recovered
      ? [{ id: 'active', title: copy.lastActive, at: checkout.updatedAt }]
      : []),
    { id: 'started', title: copy.started, at: checkout.createdAt },
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .map((e) => ({ ...e, day: fmt.day(e.at), time: fmt.pattern(e.at, TIME) }))
  // Figma "Activity": dots under day headings ("Today"), the time on the right.
  const days = [...new Set(entries.map((e) => e.day))]
  const groups = days.map((day) => ({
    key: day,
    label: day,
    items: entries.filter((e) => e.day === day),
  }))

  return (
    <DataCard title={copy.heading}>
      <Timeline variant="compact" groups={groups} />
    </DataCard>
  )
}
