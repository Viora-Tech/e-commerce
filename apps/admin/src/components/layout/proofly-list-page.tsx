import type { ReactNode } from 'react'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'

type ProoflyListPageProps = {
  title: string
  summary?: ReactNode
  /** Small link above the title that leads back to the parent section. */
  back?: { label: string; href: string }
  /** Secondary buttons first, the key primary last. */
  actions?: ReactNode
  /** Pickers between the header and the tiles (a location, a reason). */
  controls?: ReactNode
  /** A `StatStrip`; its tiles may act as filters. */
  stats?: ReactNode
  children: ReactNode
}

/**
 * Extra classes of the list frame on top of PageBody: none, since PageBody's own rhythm
 * (1.5rem between header, tiles and table; 1.5rem, 2rem from `md`, under the table) is the list
 * rhythm. Kept as an export so ListPageSkeleton draws exactly what the loaded list draws.
 */
export const LIST_PAGE_FRAME = ''

/** The list-page template on PageBody (full width) (Orders, Products, Customers…): header, optional stat tiles, then the table card. */
export default function ProoflyListPage({
  title,
  summary,
  back,
  actions,
  controls,
  stats,
  children,
}: ProoflyListPageProps) {
  // Render logic
  return (
    <PageBody>
      <PageHeader title={title} summary={summary} back={back} actions={actions} />
      {controls}
      {stats}
      {children}
    </PageBody>
  )
}
