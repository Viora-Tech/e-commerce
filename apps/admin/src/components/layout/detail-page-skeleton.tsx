import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'

const MAIN_SECTIONS = 3
const SIDE_SECTIONS = 2

/** Shape of a detail page while it loads: the header, cards in the main column and the side column. */
export default function DetailPageSkeleton() {
  return (
    <ProoflyDetailPage
      header={
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-24" />
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="ml-auto h-8 w-28" />
          </div>
        </div>
      }
      main={Array.from({ length: MAIN_SECTIONS }, (_, i) => (
        <div key={i.toString()} className="flex flex-col gap-4 rounded-xl border border-border p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-3/4" />
        </div>
      ))}
      side={Array.from({ length: SIDE_SECTIONS }, (_, i) => (
        <div key={i.toString()} className="flex flex-col gap-3 rounded-xl border border-border p-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      ))}
    />
  )
}
