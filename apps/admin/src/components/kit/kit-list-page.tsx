import type { ReactNode } from 'react'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'

type KitListPageProps = {
  title: string
  /** Primary green button plus any outline secondaries, right of the heading. */
  actions?: ReactNode
  /**
   * The band between the heading and the table card: stat tiles on orders and
   * products, category cards on collections.
   */
  strip?: ReactNode
  /** The list card itself, always a `ResourceTable`. */
  children: ReactNode
}

/**
 * The list-page shell every index screen shares: the page header with its actions,
 * an optional strip (stat tiles, category cards), then the table card, 20px apart.
 */
export default function KitListPage({ title, actions, strip, children }: KitListPageProps) {
  // Render logic
  return (
    <PageBody>
      <PageHeader title={title} actions={actions} />
      {strip}
      {children}
    </PageBody>
  )
}
