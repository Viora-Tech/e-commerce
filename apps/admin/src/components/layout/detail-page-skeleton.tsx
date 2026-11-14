import type { ReactNode } from 'react'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import ProoflyPageBody from '@/components/layout/proofly-page-body'
import StatStrip from '@/components/layout/stat-strip'
import OrderPageFrame from '@/components/orders/order-page-frame'

/**
 * Which shell the loaded page uses, so the skeleton sits in the same frame:
 * - `detail`: ProoflyDetailPage (product, discount, collection, article, menu, entry…).
 * - `order`: the order page frame, with the full-width Next step card (order, return).
 * - `columns`: PageBody + PageColumns at full width (draft order, preferences).
 * - `page`: ProoflyPageBody + PageColumns, centred at 75rem (gift card).
 * - `narrow`: one 52rem centred column (market, rollout).
 * - `full`: one full-width column (growth pages, segment, SEO).
 */
export type DetailFrame = 'detail' | 'order' | 'columns' | 'page' | 'narrow' | 'full'

type DetailPageSkeletonProps = {
  frame?: DetailFrame
  /** Cards in the main column. */
  main?: number
  /** Cards in the side column; `0` for a page without one. */
  side?: number
  /** Show the "‹ Back" link line above the title. */
  back?: boolean
  /** Header buttons on the right. */
  actions?: number
  /** Cells of a summary strip under the header (the customer page's three tiles); 0 for none. */
  strip?: number
}

const NARROW = 'mx-auto max-w-[52rem] gap-4'
const FULL = 'gap-6 md:pt-5 md:pb-8'

/** `n` DataCard skeletons, each with the given field bars and text lines. */
function cards(n: number, fields: number, lines = 0): ReactNode {
  return Array.from({ length: n }, (_, i) => (
    <DataCardSkeleton key={`card-${i.toString()}`} fields={fields} lines={lines} />
  ))
}

/**
 * Shape of a detail or form page while it loads, built from the loaded page's own parts: its
 * shell (`frame`), the page header's boxes and DataCards for the cards, so the surface, padding
 * and column widths stay put when the data arrives.
 */
export default function DetailPageSkeleton({
  frame = 'detail',
  main = 3,
  side = 2,
  back = true,
  actions = 1,
  strip = 0,
}: DetailPageSkeletonProps) {
  // Render logic
  const header = (
    <>
      <PageHeaderSkeleton back={back} actions={actions} />
      {strip > 0 ? <StatStrip loading tiles={[]} placeholders={strip} /> : null}
    </>
  )
  const mainCards = cards(main, 2)
  const sideCards = side > 0 ? cards(side, 0, 2) : undefined
  const columns = (
    <>
      {header}
      <PageColumns main={mainCards} side={sideCards} />
    </>
  )

  return frame === 'order' ? (
    <OrderPageFrame
      header={header}
      nextStep={<DataCardSkeleton fields={1} />}
      main={mainCards}
      side={sideCards}
    />
  ) : frame === 'page' ? (
    <ProoflyPageBody>{columns}</ProoflyPageBody>
  ) : frame === 'columns' ? (
    <PageBody className={FULL}>{columns}</PageBody>
  ) : frame === 'narrow' || frame === 'full' ? (
    <PageBody className={frame === 'narrow' ? NARROW : FULL}>
      {header}
      {mainCards}
    </PageBody>
  ) : (
    <ProoflyDetailPage header={header} main={mainCards} side={sideCards} />
  )
}
