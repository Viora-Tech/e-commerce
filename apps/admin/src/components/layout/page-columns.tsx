import type { ReactNode } from 'react'
import StickySideColumn from './sticky-side-column'

type PageColumnsProps = {
  main: ReactNode
  side?: ReactNode
}

/**
 * Detail-page layout after the Saleor Dashboard (BSD-3): a fluid main column and a
 * fixed side column of summary cards (status, organisation, customer), 20px apart.
 * The side column stays in view on desktop. Stacks main then side below 64rem.
 */
export default function PageColumns({ main, side }: PageColumnsProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-5">{main}</div>
      {side ? <StickySideColumn>{side}</StickySideColumn> : null}
    </div>
  )
}
