'use client'

import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'
import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import PageBody from '@/components/layout/page-body'
import { statesContent } from '@/data/states'
import { useCopy } from '@/hooks/use-copy'

type PageSkeletonProps = {
  kind: 'list' | 'detail' | 'settings'
}

const SETTINGS_SECTIONS = 3

/** Loading state (Figma "State · Page"): the shape of a list, detail or settings page. */
export default function PageSkeleton({ kind }: PageSkeletonProps) {
  // Hooks
  const copy = useCopy(statesContent)

  // Early returns
  if (kind === 'list') return <ListPageSkeleton />
  if (kind === 'detail') return <DetailPageSkeleton />

  // Render logic

  return (
    <PageBody width="narrow">
      <span className="sr-only" role="status">
        {copy.loading}
      </span>
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: SETTINGS_SECTIONS }, (_, i) => (
        <Skeleton key={i.toString()} className="h-32 rounded-xl" />
      ))}
    </PageBody>
  )
}
