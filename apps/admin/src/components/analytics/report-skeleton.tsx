import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import DataCard from '@/components/layout/data-card'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageBody from '@/components/layout/page-body'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'

type ReportSkeletonProps = {
  /** Header buttons: Export and Save on a report (2), Save on an AI answer (1). */
  actions?: number
  /** `controls`: the range and chart-shape row (a report). `note`: the snapshot banner (an AI answer). */
  lead?: 'controls' | 'note'
}

/**
 * One report while it loads (`report-view.tsx`, `answer-report-view.tsx`): the header with the
 * back link, the controls row or the snapshot note, the chart card at the chart's height
 * (metric line, total, 16rem plot) and the details table card.
 */
export default function ReportSkeleton({ actions = 2, lead = 'controls' }: ReportSkeletonProps) {
  // Render logic
  return (
    <PageBody aria-busy="true">
      <PageHeaderSkeleton back actions={actions} />
      {lead === 'controls' ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Skeleton className="h-9 w-80 max-w-full rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      ) : (
        <Skeleton className="h-16 w-full rounded-lg" />
      )}
      <DataCard
        meta={<Skeleton className="h-3 w-24" />}
        title={<Skeleton className="h-5 w-32" />}
        action={<Skeleton className="h-3.5 w-40" />}
      >
        <Skeleton className="h-[16rem] w-full" />
      </DataCard>
      <DataCardSkeleton fields={0} lines={8} />
    </PageBody>
  )
}
