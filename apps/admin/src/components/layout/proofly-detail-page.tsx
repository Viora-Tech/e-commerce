import type { ReactNode } from 'react'

type ProoflyDetailPageProps = {
  /** `ProoflyPageHeader`, plus any banner that belongs above the columns. */
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
    <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      {header}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">{main}</div>
        {side ? <div className="flex min-w-0 flex-col gap-5">{side}</div> : null}
      </div>
      {children}
    </div>
  )
}
