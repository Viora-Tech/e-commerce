import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import PageBody from '@/components/layout/page-body'

/** Shape of a detail page: header, fluid main column, fixed side column (PageColumns). */
export default function DetailPageSkeleton() {
  return (
    <PageBody>
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-md" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-64" />
        </div>
        <Skeleton className="ml-auto h-8 w-28" />
      </div>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i.toString()} className="gap-4 p-5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-3/4" />
            </Card>
          ))}
        </div>
        <div className="flex flex-col gap-5">
          {Array.from({ length: 2 }, (_, i) => (
            <Card key={i.toString()} className="gap-3 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
            </Card>
          ))}
        </div>
      </div>
    </PageBody>
  )
}
