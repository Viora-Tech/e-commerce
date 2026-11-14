import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import DataCard from '@/components/layout/data-card'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import StatStrip from '@/components/layout/stat-strip'

/* The overview's frame (`analytics-overview.tsx`): full width, the page gutter, 1.5rem rhythm. */
const FRAME = 'flex w-full flex-col gap-6 px-4 pt-4 pb-6 md:px-6 md:pt-5 md:pb-8'
const KPIS = 6

/**
 * Analytics while a page loads, in the overview's own shape: the header, the range row, the
 * six-cell KPI strip (three columns, as KpiStrip draws it), the sales chart card at the chart's
 * height and the two side-by-side cards under it. Before this, Analytics borrowed Home's skeleton.
 */
export default function AnalyticsSkeleton() {
  // Render logic
  return (
    <div className={FRAME} aria-busy="true">
      <PageHeaderSkeleton actions={1} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Skeleton className="h-9 w-80 max-w-full rounded-lg" />
        <Skeleton className="h-3.5 w-48" />
      </div>
      <StatStrip loading tiles={[]} placeholders={KPIS} columns={3} />
      <DataCard title={<Skeleton className="h-5 w-40" />}>
        <Skeleton className="h-[14.5rem] w-full" />
      </DataCard>
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <DataCardSkeleton fields={0} lines={6} />
        <DataCardSkeleton fields={0} lines={6} />
      </div>
    </div>
  )
}
