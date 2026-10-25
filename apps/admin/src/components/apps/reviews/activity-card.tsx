import DataCard from '@/components/layout/data-card'
import Timeline from '@/components/layout/timeline'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'

type Activity = Awaited<ReturnType<typeof api.reviews.get>>['activity']

type ActivityCardProps = { activity: Activity }

const labelOf = (copy: typeof reviewsContent.detail.activity, a: Activity[number]) =>
  a.kind === 'held' ? copy.held(a.reason ?? '') : copy[a.kind]

/** What happened to the review, newest first: requested, written, held, published, replied. */
export default function ActivityCard({ activity }: ActivityCardProps) {
  // Hooks
  const { detail } = useCopy(reviewsContent)

  // Render logic
  const copy = detail.activity

  return (
    <DataCard title={copy.title}>
      <Timeline
        variant="compact"
        items={activity.map((a) => ({
          id: `${a.kind}-${String(a.at)}`,
          title: labelOf(copy, a),
          at: a.at,
        }))}
      />
    </DataCard>
  )
}
