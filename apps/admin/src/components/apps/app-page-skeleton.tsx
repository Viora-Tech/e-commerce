import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageBody from '@/components/layout/page-body'

/**
 * An app's page while it loads, in AppShell's frame (`apps/app-shell.tsx`): the header row
 * (logo, breadcrumb, name and status, buttons) over a hairline, then the content column of
 * cards. The app's own side menu is not drawn, since not every app has one.
 */
export default function AppPageSkeleton() {
  // Render logic
  return (
    <PageBody>
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="flex items-center gap-x-3.5 border-panel-border border-b pb-4">
          <Skeleton className="size-11 shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex h-5 items-center">
              <Skeleton className="h-3 w-24" />
            </span>
            <span className="flex h-6.5 items-center">
              <Skeleton className="h-5 w-40" />
            </span>
          </div>
          <Skeleton className="h-9 w-28 rounded-sm" />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <DataCardSkeleton fields={2} />
        <DataCardSkeleton fields={0} lines={4} />
      </div>
    </PageBody>
  )
}
