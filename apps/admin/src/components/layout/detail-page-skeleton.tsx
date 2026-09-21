import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { PageBody } from '@/components/layout/page-body'

/** Shape of a detail page: header, two thirds main column, one third side column. */
export function DetailPageSkeleton() {
  return (
    <PageBody width="narrow">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i.toString()} className="gap-4 p-6">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-3/4" />
            </Card>
          ))}
        </div>
        <div className="flex flex-col gap-6">
          {Array.from({ length: 2 }, (_, i) => (
            <Card key={i.toString()} className="gap-4 p-6">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ))}
        </div>
      </div>
    </PageBody>
  )
}
