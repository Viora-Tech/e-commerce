import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import DataCard from '@/components/layout/data-card'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageBody from '@/components/layout/page-body'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import StatStrip from '@/components/layout/stat-strip'
import { analyticsContent } from '@/data/analytics'

const KPIS = 6

/**
 * The Analytics overview while it loads, in its own shape (`analytics-overview.tsx`): the page
 * shell, the real title with the Export button, the range row, the six-cell KPI strip (three
 * columns, as KpiStrip draws it), the sales chart card at the chart's height and the two
 * side-by-side cards under it.
 */
export default function AnalyticsSkeleton() {
  // Render logic
  return (
    <PageBody aria-busy="true">
      <PageHeaderSkeleton title={analyticsContent.title} actions={1} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Skeleton className="h-9 w-80 max-w-full rounded-lg" />
        <Skeleton className="h-3.5 w-48" />
      </div>
      <StatStrip loading tiles={[]} placeholders={KPIS} columns={3} />
      <DataCard title={analyticsContent.salesOverTime.title}>
        <Skeleton className="h-[14.5rem] w-full" />
      </DataCard>
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <DataCardSkeleton fields={0} lines={6} />
        <DataCardSkeleton fields={0} lines={6} />
      </div>
    </PageBody>
  )
}
