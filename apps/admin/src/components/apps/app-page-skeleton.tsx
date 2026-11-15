import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageBody from '@/components/layout/page-body'

/**
 * An app's page while it loads, in AppShell's frame (`apps/app-shell.tsx`): the PageHeader every
 * app page has (the "‹ Apps" back line, the 3rem logo, the name at the page-title size with its
 * status chip, the "…" menu on the right), then the content column of cards. The app's own menu
 * is not drawn: on desktop it sits in the main sidebar, and not every app has one.
 */
export default function AppPageSkeleton() {
  // Render logic
  return (
    <PageBody>
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="flex flex-col gap-3" aria-hidden="true">
          <span className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-16" />
          </span>
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="flex min-w-[min(100%,16rem)] flex-1 items-start gap-4">
              <Skeleton className="size-12 shrink-0 rounded-xl" />
              <div className="flex min-w-0 flex-1 items-center gap-x-3">
                <span className="flex h-9 items-center">
                  <Skeleton className="h-7 w-40" />
                </span>
                <Skeleton className="h-5.5 w-16 rounded-full" />
              </div>
            </div>
            <Skeleton className="size-9 rounded-sm" />
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <DataCardSkeleton fields={0} lines={3} />
        <DataCardSkeleton fields={2} />
      </div>
    </PageBody>
  )
}
