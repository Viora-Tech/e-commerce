'use client'

import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import PageBody from '@/components/layout/page-body'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import { contentContent } from '@/data/content'
import { useCopy } from '@/hooks/use-copy'

/* Files, Content types, Menus and Blog posts. */
const CARDS = 4

/**
 * The Content hub while it loads: the real title and the four cards' boxes (icon tile, title
 * and count lines, the body line and the Open button) at the loaded cards' sizes.
 */
export default function ContentHubSkeleton() {
  // Hooks
  const copy = useCopy(contentContent)

  // Render logic
  return (
    <PageBody>
      <PageHeaderSkeleton title={copy.title} actions={0} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true">
        {Array.from({ length: CARDS }, (_, i) => (
          <div
            key={`hub-${i.toString()}`}
            className="flex min-w-0 flex-col items-start gap-3.5 rounded-lg border surface-card px-5.5 py-5"
          >
            <div className="flex w-full items-center gap-3.5">
              <Skeleton className="size-11 shrink-0 rounded-xl" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48 max-w-full" />
              </div>
            </div>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-9 w-24 rounded-sm" />
          </div>
        ))}
      </div>
    </PageBody>
  )
}
