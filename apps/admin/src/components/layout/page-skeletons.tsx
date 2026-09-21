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
