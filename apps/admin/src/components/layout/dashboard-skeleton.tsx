import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { PageBody } from '@/components/layout/page-body'

/** Dashboard shape: three stat cards, a chart, two data cards. */
export function DashboardSkeleton() {
  return (
    <PageBody>
      <div className="grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i.toString()} className="gap-4 p-5">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-2 h-8 w-32" />
            <Skeleton className="h-4 w-40" />
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="gap-4 p-5">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-56 w-full" />
        </Card>
        <Card className="gap-4 p-5">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i.toString()} className="h-12 w-full" />
          ))}
        </Card>
      </div>
    </PageBody>
  )
}
