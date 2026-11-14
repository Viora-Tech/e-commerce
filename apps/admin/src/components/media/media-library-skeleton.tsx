'use client'

import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'

/* Storage and Upload files. */
const HEADER_ACTIONS = 2
/* Two rows of the five-across grid. */
const TILES = 10

/**
 * Files while the route loads: the real title and buttons, then the library card as it draws
 * (the toolbar row with the type picker, search and view toggle, and the tile grid).
 */
export default function MediaLibrarySkeleton() {
  // Hooks
  const { library: copy } = useCopy(mediaContent)

  // Render logic
  const card = (
    <div className="overflow-hidden rounded-lg border surface-card" aria-busy="true">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2">
        <Skeleton className="h-9 w-28 rounded-sm" />
        <span aria-hidden="true" className="h-5 w-px bg-line" />
        <Skeleton className="h-4 min-w-0 flex-1" />
        <Skeleton className="h-9 w-18 rounded-sm" />
      </div>
      <ul className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: TILES }, (_, i) => (
          <li key={`tile-${i.toString()}`} className="flex flex-col gap-2">
            <Skeleton className="aspect-[4/3] w-full rounded-lg" />
            <Skeleton className="h-3.5 w-3/4" />
          </li>
        ))}
      </ul>
    </div>
  )

  return <ListPageSkeleton title={copy.title} actions={HEADER_ACTIONS} tiles={0} table={card} />
}
