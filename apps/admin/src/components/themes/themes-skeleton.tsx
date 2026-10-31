import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import ProoflyPageBody from '@/components/layout/proofly-page-body'

/** Online Store › Themes while the library loads: header, tabs, the live card, the library card. */
export default function ThemesSkeleton() {
  // Render logic
  return (
    <ProoflyPageBody width="full">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <Skeleton className="h-[2.375rem] w-48 rounded-[0.6875rem]" />
      <div className="flex flex-col gap-6 rounded-2xl border border-border surface-card px-4 py-4 md:flex-row md:px-[1.375rem] md:py-5">
        <Skeleton className="aspect-[420/260] w-full rounded-xl md:w-[26.25rem]" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <div className="flex gap-2.5">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="size-9" />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-2xl border border-border surface-card px-4 py-4 md:px-[1.375rem] md:py-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <Skeleton className="mx-auto mt-8 mb-6 h-24 w-80 max-w-full" />
      </div>
    </ProoflyPageBody>
  )
}
