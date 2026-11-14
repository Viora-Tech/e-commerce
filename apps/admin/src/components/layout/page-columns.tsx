import type { ReactNode } from 'react'
import StickyColumns from './sticky-columns'

type PageColumnsProps = {
  main: ReactNode
  side?: ReactNode
}

/**
 * Detail-page layout after the Saleor Dashboard (BSD-3): a fluid main column and a
 * fixed 23.5rem side column of summary cards (status, organisation, customer), 1.5rem apart,
 * the same as the Proofly detail frame and the order page.
 * On desktop the shorter column stays in view. Stacks main then side below 64rem.
 */
export default function PageColumns({ main, side }: PageColumnsProps) {
  return (
    <StickyColumns
      main={main}
      side={side}
      gap={6}
      className="gap-6 lg:grid-cols-[minmax(0,1fr)_23.5rem]"
    />
  )
}
