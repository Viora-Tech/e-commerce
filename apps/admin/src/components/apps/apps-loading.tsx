import { Skeleton } from '@commerce/ui/shadcn/skeleton'

/** Placeholder cards while the app list loads. */
export default function AppsLoading({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
          key={i}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-[1.125rem]"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-[0.625rem]" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-9 w-24" />
        </div>
      ))}
    </>
  )
}
