import type { ReactNode } from 'react'

type PageColumnsProps = {
  main: ReactNode
  side?: ReactNode
}

/** Two-column layout: main content plus a narrower side rail (status, organisation…). */
export function PageColumns({ main, side }: PageColumnsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-5">{main}</div>
      {side ? <div className="flex min-w-0 flex-col gap-5">{side}</div> : null}
    </div>
  )
}
