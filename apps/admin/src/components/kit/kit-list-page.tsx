import type { ReactNode } from 'react'
import PageHeader from '@/components/layout/page-header'

type KitListPageProps = {
  title: string
  /** Secondary buttons, then the ink primary action last. */
  actions?: ReactNode
  /** The band between the header and the list: a stat strip or category cards. */
  strip?: ReactNode
  /** The list itself, always a `ResourceTable`. */
  children: ReactNode
}

/**
 * The list-page shell every index screen shares, after the Saleor Dashboard list layout
 * (BSD-3): the header on a hairline, an optional strip, then the list edge to edge on the
 * white panel. The strip keeps its cards; `[data-layout=sections]` flattens the table card.
 */
export default function KitListPage({ title, actions, strip, children }: KitListPageProps) {
  // Render logic
  return (
    <div className="flex min-h-full flex-col">
      <div className="border-border border-b px-4 py-5 md:px-6">
        <PageHeader title={title} actions={actions} />
      </div>
      {strip ? <div className="border-border border-b px-4 py-5 md:px-6">{strip}</div> : null}
      <div data-layout="sections">{children}</div>
    </div>
  )
}
