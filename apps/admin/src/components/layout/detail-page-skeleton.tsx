import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import DetailLayout from '@/components/layout/detail-layout'

const MAIN_SECTIONS = 3
const SIDE_SECTIONS = 2

/** Shape of a detail page while it loads: the DetailLayout header, sections and right column. */
export default function DetailPageSkeleton() {
  return (
    <DetailLayout
      header={
        <div className="flex items-center gap-4">
          <Skeleton className="size-8 rounded-md" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="ml-auto h-8 w-28" />
        </div>
      }
      main={Array.from({ length: MAIN_SECTIONS }, (_, i) => (
        <div
          key={i.toString()}
          className="flex flex-col gap-4 border-border border-b px-4 py-6 md:px-6"
        >
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-3/4" />
        </div>
      ))}
      side={Array.from({ length: SIDE_SECTIONS }, (_, i) => (
        <div
          key={i.toString()}
          className="flex flex-col gap-3 border-border border-b px-4 py-6 md:px-6"
        >
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      ))}
    />
  )
}
