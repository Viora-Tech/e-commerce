import type { ReactNode } from 'react'
import PageBody from './page-body'

type ProoflyPageBodyProps = {
  children: ReactNode
  /** `detail` (default): centred at 75rem like the order and product pages (audit #30).
   *  `full`: the panel's whole width, for list-like screens (themes library). */
  width?: 'detail' | 'full'
}

/** Detail and form screens without columns: PageBody at the detail width. */
export default function ProoflyPageBody({ children, width = 'detail' }: ProoflyPageBodyProps) {
  // Render logic
  return <PageBody width={width}>{children}</PageBody>
}
