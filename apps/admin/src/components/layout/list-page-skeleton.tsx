import type { ReactNode } from 'react'
import PageBody from '@/components/layout/page-body'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import { LIST_PAGE_FRAME } from '@/components/layout/proofly-list-page'
import StatStrip from '@/components/layout/stat-strip'
import ResourceTableSkeleton from '@/components/table/resource-table-skeleton'

type ListPageSkeletonProps = {
  /** The page's title, when the loader knows it. */
  title?: string | undefined
  /** Header buttons on the right. */
  actions?: number
  /** Cells in the stat strip; `0` for a list without one. */
  tiles?: number
  /**
   * The table card. A page that knows its columns passes its real `ResourceTable` with
   * `loading` (as Orders does), so the header labels and column widths match too.
   */
  table?: ReactNode
}

/**
 * A list page while its route loads, built from the loaded page's own parts: the ProoflyListPage
 * frame, the page header's boxes, the joined StatStrip with skeleton cells and the table card at
 * ResourceTable's heights. The table therefore starts where it will stay when the data arrives.
 */
export default function ListPageSkeleton({
  title,
  actions = 1,
  tiles = 4,
  table,
}: ListPageSkeletonProps) {
  // Render logic
  return (
    <PageBody className={LIST_PAGE_FRAME}>
      <PageHeaderSkeleton title={title} actions={actions} />
      {tiles > 0 ? <StatStrip loading tiles={[]} placeholders={tiles} /> : null}
      {table ?? <ResourceTableSkeleton />}
    </PageBody>
  )
}
