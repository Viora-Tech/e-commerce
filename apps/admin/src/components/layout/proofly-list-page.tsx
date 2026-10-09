import type { ReactNode } from 'react'
import ProoflyPageHeader from './proofly-page-header'

type ProoflyListPageProps = {
  title: string
  summary?: ReactNode
  /** Secondary buttons first, the key primary last. */
  actions?: ReactNode
  /** Pickers between the header and the tiles (a location, a reason). */
  controls?: ReactNode
  /** Stat tiles row (`StatTile`s); they may act as filters. */
  stats?: ReactNode
  children: ReactNode
}

/** The list-page shell of the Proofly frames: header, optional stat tiles, then the table card. */
export default function ProoflyListPage({
  title,
  summary,
  actions,
  controls,
  stats,
  children,
}: ProoflyListPageProps) {
  // Render logic
  return (
    <div className="mx-auto flex w-full max-w-[77.5rem] flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <ProoflyPageHeader title={title} summary={summary} actions={actions} />
      {controls}
      {stats ? <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{stats}</div> : null}
      {children}
    </div>
  )
}
