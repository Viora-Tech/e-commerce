import { CircleCheck, Clock, Send, ShoppingCart } from '@commerce/ui/icons'
import DataCard from '@/components/layout/data-card'
import Timeline from '@/components/layout/timeline'
import { abandonedDetailContent } from '@/data/abandoned-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { AbandonedCheckout } from './abandoned-detail-types'

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
      ? [
          {
            id: 'recovered',
            title: copy.recovered,
            at: checkout.updatedAt,
            icon: CircleCheck,
            tone: 'success' as const,
          },
        ]
      : []),
    ...(checkout.recoverySentAt
      ? [{ id: 'reminded', title: copy.reminded, at: checkout.recoverySentAt, icon: Send }]
      : []),
    ...(touched - new Date(checkout.createdAt).getTime() > 60_000 && !checkout.recovered
      ? [{ id: 'active', title: copy.lastActive, at: checkout.updatedAt, icon: Clock }]
      : []),
    { id: 'started', title: copy.started, at: checkout.createdAt, icon: ShoppingCart },
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .map((e) => ({ ...e, time: fmt.when(e.at) }))

  return (
    <DataCard title={copy.heading}>
      <Timeline items={entries} />
    </DataCard>
  )
}
