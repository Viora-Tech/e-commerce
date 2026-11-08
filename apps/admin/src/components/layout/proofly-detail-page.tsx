import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'
import FocusFromQuery from './focus-from-query'
import StickyColumns from './sticky-columns'

type ProoflyDetailPageProps = {
  /** `PageHeader`, plus any banner that belongs above the columns. */
  header: ReactNode
  main: ReactNode
  side?: ReactNode
  /** Dialogs and floating bars. */
  children?: ReactNode
}

/** Detail-page shell of the Proofly frames: header on top, a fluid main column and a 23.5rem side column; on desktop the shorter column stays in view. */
export default function ProoflyDetailPage({
  header,
  main,
  side,
  children,
}: ProoflyDetailPageProps) {
  // Render logic
  return (
    // Centred at 75rem like the order page (audit #14).
    <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-6 px-4 pt-4 pb-6 md:px-8 md:pt-5 md:pb-8">
      {header}
      {/* Two columns only with a side column; without one the main column takes the width
          (an empty content type left half the page blank, audit #184). */}
      <StickyColumns
        main={main}
        side={side}
        gap={6}
        className={cn('gap-6', side && 'lg:grid-cols-[minmax(0,1fr)_23.5rem]')}
      />
      {children}
      <FocusFromQuery />
    </div>
  )
}
