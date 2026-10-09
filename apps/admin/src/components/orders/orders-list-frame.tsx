import type { ReactNode } from 'react'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'

type OrdersListFrameProps = {
  title: string
  /** The plain-language line under the title. */
  summary?: ReactNode
  /** Header buttons: small plain ones first, the one key button last. */
  actions?: ReactNode
  /** The row of stat cards between the header and the table card. */
  tiles?: ReactNode
  children: ReactNode
}

/** The frame every Orders list page shares (Figma "Orders / List"): title and summary, stat cards, then the table card. */
export default function OrdersListFrame({
  title,
  summary,
  actions,
  tiles,
  children,
}: OrdersListFrameProps) {
  return (
    <PageBody className="max-w-[77.5rem] gap-6 md:py-8">
      <PageHeader title={title} subtitle={summary} actions={actions} />
      {tiles ? <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{tiles}</div> : null}
      {children}
    </PageBody>
  )
}
