import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { PageBody } from '@/components/layout/page-body'

const ROWS = 6

/** Shape of a list page while the first fetch runs: tabs, toolbar, rows. */
export function ListPageSkeleton() {
  return (
    <PageBody>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-10 w-72 rounded-full" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Card className="gap-0 p-5">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-9 w-20" />
        </div>
        <Skeleton className="mt-4 h-12 w-full" />
        {Array.from({ length: ROWS }, (_, i) => (
          <div
            key={i.toString()}
            className="flex h-[54px] items-center gap-6 border-b border-border-soft"
          >
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="ml-auto h-4 w-20" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </Card>
    </PageBody>
  )
}

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
