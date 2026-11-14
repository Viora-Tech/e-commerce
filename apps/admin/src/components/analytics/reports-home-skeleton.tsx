import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import PageBody from '@/components/layout/page-body'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import { analyticsContent } from '@/data/analytics'

const SAVED = 3
const TEMPLATES = 6

/** A section head (title and intro line) as SectionHead draws it. */
const HEAD = (
  <div className="flex flex-col gap-1">
    <Skeleton className="h-5 w-40" />
    <Skeleton className="h-3.5 w-72 max-w-full" />
  </div>
)

/**
 * Analytics, Reports while it loads (`reports-home.tsx`): the real title with the Write a query
 * button, the ask box and its chips, a row of saved-report cards, then the ready-made report
 * tiles under their topic.
 */
export default function ReportsHomeSkeleton() {
  // Render logic
  return (
    <PageBody aria-busy="true">
      <PageHeaderSkeleton title={analyticsContent.reports.title} actions={1} />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-15 w-full rounded-lg" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-36 rounded-full" />
          <Skeleton className="h-8 w-44 rounded-full" />
          <Skeleton className="h-8 w-32 rounded-full" />
        </div>
      </div>
      <section className="flex flex-col gap-3">
        {HEAD}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: SAVED }, (_, i) => (
            <Skeleton key={`saved-${i.toString()}`} className="h-36 rounded-lg" />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-5">
        {HEAD}
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-24" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: TEMPLATES }, (_, i) => (
              <Skeleton key={`template-${i.toString()}`} className="h-24 rounded-lg" />
            ))}
          </div>
        </div>
      </section>
    </PageBody>
  )
}
