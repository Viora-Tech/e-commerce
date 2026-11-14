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
 * The list frame on top of PageBody's gutter (1rem, 1.5rem from `md`): 1.5rem between header,
 * tiles and table, and 1.5rem (2rem from `md`) under the table. ListPageSkeleton draws the same.
 */
export const LIST_PAGE_FRAME = 'gap-6 pb-6 md:pb-8'

/** The one list-page shell (Orders, Products, Customers…): header, optional stat tiles, then the table card. */
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
    <PageBody className={LIST_PAGE_FRAME}>
      <PageHeader title={title} summary={summary} back={back} actions={actions} />
      {controls}
      {stats}
      {children}
    </PageBody>
  )
}
