import { Skeleton } from '@commerce/ui/shadcn/skeleton'

/**
 * Live view while it loads (`live-view.tsx`): the full-height globe area with the glass header
 * at the top left and the two floating cards (figures, then activity) at their widths.
 */
export default function LiveSkeleton() {
  // Render logic
  return (
    <div
      aria-busy="true"
      className="h-[calc(100svh-3.5rem)] min-h-[34rem] w-full md:h-[calc(100svh-4rem)]"
    >
      <div className="flex size-full flex-col gap-3 p-3 md:p-5">
        <Skeleton className="h-24 w-[28rem] max-w-[calc(100%-9.5rem)] rounded-lg md:max-w-[calc(100%-11rem)]" />
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 lg:flex-row lg:items-start lg:justify-between">
          <Skeleton className="h-80 w-full rounded-lg lg:w-[22rem]" />
          <Skeleton className="h-64 w-full rounded-lg lg:w-[22rem]" />
        </div>
      </div>
    </div>
  )
}
