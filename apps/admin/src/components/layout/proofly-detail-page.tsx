import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'
import FocusFromQuery from './focus-from-query'
import StickySideColumn from './sticky-side-column'

type ProoflyDetailPageProps = {
  /** `PageHeader`, plus any banner that belongs above the columns. */
  header: ReactNode
  main: ReactNode
  side?: ReactNode
  /** Dialogs and floating bars. */
  children?: ReactNode
}

/** Detail-page shell of the Proofly frames: header on top, a fluid main column and a 22rem side column that stays in view on desktop (scrolling on its own when taller than the screen). */
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
      <div
        className={cn(
          'grid grid-cols-1 items-start gap-6',
          side && 'lg:grid-cols-[minmax(0,1fr)_23.5rem]',
        )}
      >
        <div className="flex min-w-0 flex-col gap-6">{main}</div>
        {side ? <StickySideColumn gap={6}>{side}</StickySideColumn> : null}
      </div>
      {children}
      <FocusFromQuery />
    </div>
  )
}
