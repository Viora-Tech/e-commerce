import { Skeleton } from '@commerce/ui/shadcn/skeleton'

type PickupDrawerSkeletonProps = {
  /** Read out while the pickup details load. */
  label: string
}

/* The day cards: three side by side from `sm`. */
const DAYS = ['today', 'tomorrow', 'later'] as const

/**
 * The Create pickup drawer while its details load: the same two boxes as the loaded drawer
 * (location, day and time on the left; the parcel and the buttons on the right) with bars at the
 * fields' heights, so nothing jumps when the details arrive.
 */
export default function PickupDrawerSkeleton({ label }: PickupDrawerSkeletonProps) {
  // Render logic
  return (
    <div
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <section className="flex flex-col gap-5 rounded-lg border border-hairline p-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <div className="grid gap-3 sm:grid-cols-3">
            {DAYS.map((d) => (
              <Skeleton key={d} className="h-19 w-full" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-20" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      </section>
      <section className="flex flex-col justify-between gap-5 rounded-lg border border-hairline p-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-12 w-full" />
        </div>
        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-32" />
        </div>
      </section>
    </div>
  )
}
