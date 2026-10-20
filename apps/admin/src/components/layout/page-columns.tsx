import type { ReactNode } from 'react'

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
      {side ? (
        <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-6 lg:-m-1 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto lg:p-1 no-scrollbar">
          {side}
        </div>
      ) : null}
    </div>
  )
}
