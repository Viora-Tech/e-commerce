import type { ReactNode } from 'react'

type ProoflyDetailPageProps = {
  /** `PageHeader`, plus any banner that belongs above the columns. */
  header: ReactNode
  main: ReactNode
  side?: ReactNode
  /** Dialogs and floating bars. */
  children?: ReactNode
}

/** Detail-page shell of the Proofly frames: header on top, a fluid main column and a 22rem side column. */
export default function ProoflyDetailPage({
  header,
  main,
  side,
  children,
}: ProoflyDetailPageProps) {
  // Render logic
  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      {header}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23.5rem]">
        <div className="flex min-w-0 flex-col gap-6">{main}</div>
        {side ? <div className="flex min-w-0 flex-col gap-6">{side}</div> : null}
      </div>
      {children}
    </div>
  )
}
