import DataCard from '@/components/layout/data-card'
import RelativeTime from '@/components/layout/relative-time'
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
      <ol className="flex flex-col gap-3">
        {activity.map((a) => (
          <li key={`${a.kind}-${String(a.at)}`} className="flex items-center gap-3 text-body">
            <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">{labelOf(copy, a)}</span>
            <RelativeTime value={a.at} className="shrink-0 text-caption text-muted-foreground" />
          </li>
        ))}
      </ol>
    </DataCard>
  )
}
