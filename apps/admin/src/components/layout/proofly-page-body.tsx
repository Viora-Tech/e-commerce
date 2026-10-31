import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type ProoflyPageBodyProps = {
  children: ReactNode
  /** `detail` (default): centred at 75rem like the order and product pages (audit #30).
   *  `full`: the panel's whole width, for list-like screens (themes library). */
  width?: 'detail' | 'full'
}

/** Page frame of the Proofly detail and form screens: centred column with the page gutter. */
export default function ProoflyPageBody({ children, width = 'detail' }: ProoflyPageBodyProps) {
  // Render logic
  return (
    <div
      className={cn(
        'flex w-full flex-col gap-6 px-4 pt-4 pb-6 md:px-8 md:pt-5 md:pb-8',
        width === 'detail' && 'mx-auto max-w-[75rem]',
      )}
    >
      {children}
    </div>
  )
}
