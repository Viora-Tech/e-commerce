import { Users } from '@commerce/ui/icons'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import EmptyState from '@/components/layout/empty-state'
import { segmentsContent as copy } from '@/data/customers'
import type { api } from '@/lib/api-client'
import { day } from './customer-detail-types'

type Segment = Awaited<ReturnType<typeof api.customers.segments>>[number]

type SegmentsListProps = { segments: Segment[] }

/** Saved filters with the count each one matches right now. */
export default function SegmentsList({ segments }: SegmentsListProps) {
  // Early returns
  if (segments.length === 0) {
    return (
      <Card>
        <EmptyState icon={Users} heading={copy.empty.heading} body={copy.empty.body} />
      </Card>
    )
  }

  // Render logic
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {segments.map((s) => (
        <Card key={s.id} className="p-5 transition-shadow hover:shadow-card-hover">
          <Link href={`/customers/segments/${s.id}`} className="flex flex-col gap-2">
            <span className="text-card-title text-ink-strong">{s.name}</span>
            <span className="text-stat text-ink-strong tabular-nums">
              {copy.builder.previewCount(s.customerCount)}
            </span>
            <span className="text-caption text-muted-foreground-soft">
              {copy.columns.updated} {day(s.updatedAt)}
            </span>
          </Link>
        </Card>
      ))}
    </div>
  )
}
