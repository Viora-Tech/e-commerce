'use client'

import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import DataCard from '@/components/layout/data-card'
import PageBody from '@/components/layout/page-body'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'

/* Library rows drawn while the themes load. */
const ROWS = 2

/**
 * Online Store › Themes while the library loads (`themes/loading.tsx`), built from the loaded
 * page's parts: the real title with the visibility chip and Add theme, the live theme card (the
 * storefront stage, then the name line and its buttons), the Theme library card with its real
 * title and a few rows, and the import banner. Nothing moves when the themes arrive.
 */
export default function ThemesSkeleton() {
  // Hooks
  const { title } = useCopy(themesContent)
  const copy = useCopy(themesContent.library)

  // Render logic
  return (
    <PageBody aria-busy="true">
      <PageHeaderSkeleton title={title} actions={2} />
      <Card gap="none" inset="none" aria-hidden="true">
        <div className="flex justify-center border-b border-border bg-muted/40 px-6 pt-8 md:px-10">
          <div className="w-full max-w-[41rem] pb-10">
            <Skeleton className="aspect-[1440/1080] w-full rounded-b-none rounded-t-xl" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6 md:py-5">
          <div className="flex flex-col gap-1">
            <span className="flex h-7 items-center">
              <Skeleton className="h-5 w-48" />
            </span>
            <span className="flex h-5 items-center">
              <Skeleton className="h-3.5 w-64 max-w-full" />
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="size-9 rounded-sm" />
            <Skeleton className="h-9 w-24 rounded-sm" />
            <Skeleton className="h-9 w-28 rounded-sm" />
          </div>
        </div>
      </Card>
      <DataCard
        title={copy.libraryHeading}
        subtitle={copy.libraryBody}
        action={<Skeleton className="h-9 w-32 rounded-sm" />}
        flush
      >
        <ul className="divide-y divide-border border-t border-border" aria-hidden="true">
          {Array.from({ length: ROWS }, (_, i) => (
            <li
              key={`row-${i.toString()}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 md:px-5"
            >
              <Skeleton className="aspect-[104/68] w-26 shrink-0 rounded-md" />
              <div className="flex min-w-0 flex-1 basis-48 flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3.5 w-56 max-w-full" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-24 rounded-sm" />
                <Skeleton className="size-9 rounded-sm" />
              </div>
            </li>
          ))}
        </ul>
      </DataCard>
    </PageBody>
  )
}
