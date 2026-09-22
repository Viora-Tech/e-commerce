import type { ReactNode } from 'react'
import PageBody from '@/components/layout/page-body'

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
 * The list-page shell every index screen shares, drawn to frame 5:2353 and
 * 5:3936: a 48px heading row with its actions, an optional strip, then the
 * table card 20px below it.
 */
export default function KitListPage({ title, actions, strip, children }: KitListPageProps) {
  // Render logic
  return (
    <PageBody width="frame" className="gap-6">
      <div className="flex h-12 items-center justify-between gap-3">
        <h1 className="text-kit-heading text-ink-strong">{title}</h1>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </div>
      {strip}
      <div className={strip ? '-mt-1' : undefined}>{children}</div>
    </PageBody>
  )
}
