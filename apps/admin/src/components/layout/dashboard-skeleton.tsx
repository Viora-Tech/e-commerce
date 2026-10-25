import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import PageBody from '@/components/layout/page-body'

const STILL = 'motion-reduce:animate-none'

/** Home's loading shape: one block per real section, at that section's height. */
export default function DashboardSkeleton() {
  return (
    <PageBody width="frame" className="mx-auto max-w-[68rem] gap-10 md:pt-5" aria-hidden="true">
      <div className="mx-auto flex w-full max-w-[48rem] flex-col gap-10">
        <div className="flex flex-col gap-1">
          <Skeleton className={`h-9 w-64 ${STILL}`} />
          <Skeleton className={`h-5 w-96 max-w-full ${STILL}`} />
        </div>
        <Skeleton className={`h-[3.75rem] w-full ${STILL}`} />
      </div>
      <Skeleton className={`h-[26rem] w-full ${STILL}`} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i.toString()} className={`h-[5.5rem] w-full ${STILL}`} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i.toString()} className={`h-40 w-full ${STILL}`} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Skeleton className={`h-72 w-full ${STILL}`} />
        <Skeleton className={`h-72 w-full ${STILL}`} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i.toString()} className={`h-28 w-full ${STILL}`} />
        ))}
      </div>
    </PageBody>
  )
}
