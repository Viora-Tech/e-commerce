import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import DataCard from '@/components/layout/data-card'
import PageBody from '@/components/layout/page-body'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'

/**
 * The custom query page while it loads (`query/query-report-view.tsx`): the header with the
 * back link and Export and Save, the editor beside its 18rem side panel, and the result card.
 */
export default function QuerySkeleton() {
  // Render logic
  return (
    <PageBody aria-busy="true">
      <PageHeaderSkeleton back actions={2} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Skeleton className="h-72 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
      <DataCard
        title={<Skeleton className="h-5 w-32" />}
        action={<Skeleton className="h-9 w-44 rounded-lg" />}
      >
        <Skeleton className="h-[16rem] w-full" />
      </DataCard>
    </PageBody>
  )
}
