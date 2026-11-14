import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'
import StickyColumns from './sticky-columns'

type PageColumnsProps = {
  main: ReactNode
  side?: ReactNode
  /** `aside` for the order page's side column; a plain `div` elsewhere. */
  sideAs?: 'div' | 'aside'
}

/**
 * The one detail-page column layout (after the Saleor Dashboard, BSD-3): a fluid main column and
 * a fixed 23.5rem side column of summary cards (status, organisation, customer), 1.5rem apart.
 * ProoflyDetailPage, the order page and every PageColumns page share it, so the side column has
 * one width everywhere. Without a side column the main column takes the whole width. On desktop
 * the shorter column stays in view. Stacks main then side below 64rem.
 */
export default function PageColumns({ main, side, sideAs }: PageColumnsProps) {
  return (
    <StickyColumns
      main={main}
      side={side}
      sideAs={sideAs}
      gap={6}
      className={cn('gap-6', side && 'lg:grid-cols-[minmax(0,1fr)_23.5rem]')}
    />
  )
}
