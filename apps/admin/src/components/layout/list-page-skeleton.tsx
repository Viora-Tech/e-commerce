import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { PageBody } from '@/components/layout/page-body'

const ROWS = 6

/** Shape of a list page (frame 5:2353) while the first fetch runs: heading, tiles, table card. */
export function ListPageSkeleton() {
  return (
    <PageBody className="gap-6">
      <div className="flex h-9 items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i.toString()} className="h-[7.5rem] rounded-lg" />
        ))}
      </div>
      <Card className="gap-0 p-5">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-96" />
          <Skeleton className="h-8 w-60" />
        </div>
        <Skeleton className="mt-5 h-10 w-full rounded-[0.375rem]" />
        {Array.from({ length: ROWS }, (_, i) => (
          <div
            key={i.toString()}
            className="flex h-12 items-center gap-6 border-b border-line px-4"
          >
            <Skeleton className="size-5" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="size-10 rounded-[0.25rem]" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </Card>
    </PageBody>
  )
}
