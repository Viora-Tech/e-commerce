import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import PageBody from '@/components/layout/page-body'

const ROWS = 8

/** Shape of a list page while the first fetch runs: header, tiles, then the table card. */
export default function ListPageSkeleton() {
  return (
    <PageBody>
      <div className="flex h-8 items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i.toString()} className="h-24 rounded-lg" />
        ))}
      </div>
      <Card className="gap-0 py-0">
        <div className="flex h-11 items-center gap-5 border-b border-border px-4">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-3.5 w-14" />
        </div>
        <div className="flex items-center gap-2 px-4 py-3">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="h-10 border-b border-border" />
        {Array.from({ length: ROWS }, (_, i) => (
          <div
            key={i.toString()}
            className="flex h-12 items-center gap-6 border-b border-line px-4 last:border-0"
          >
            <Skeleton className="size-4" />
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="ml-auto h-3.5 w-20" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        ))}
      </Card>
    </PageBody>
  )
}
