import type { ReactNode } from 'react'
import StickyColumns from './sticky-columns'

type PageColumnsProps = {
  main: ReactNode
  side?: ReactNode
}

/**
 * Detail-page layout after the Saleor Dashboard (BSD-3): a fluid main column and a
 * fixed side column of summary cards (status, organisation, customer), 20px apart.
 * On desktop the shorter column stays in view. Stacks main then side below 64rem.
 */
export default function PageColumns({ main, side }: PageColumnsProps) {
  return (
    <StickyColumns
      main={main}
      side={side}
      className="gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]"
    />
  )
}
