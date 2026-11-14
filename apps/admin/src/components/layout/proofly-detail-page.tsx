import type { ReactNode } from 'react'
import FocusFromQuery from './focus-from-query'
import PageBody from './page-body'
import PageColumns from './page-columns'

type ProoflyDetailPageProps = {
  /** `PageHeader`, plus any banner that belongs above the columns. */
  header: ReactNode
  main: ReactNode
  side?: ReactNode
  /** Dialogs and floating bars. */
  children?: ReactNode
}

/** Detail-page shell: PageBody at the detail width (75rem), the header, then PageColumns (fluid main, 23.5rem side). */
export default function ProoflyDetailPage({
  header,
  main,
  side,
  children,
}: ProoflyDetailPageProps) {
  // Render logic
  return (
    <PageBody width="detail">
      {header}
      <PageColumns main={main} side={side} />
      {children}
      <FocusFromQuery />
    </PageBody>
  )
}
