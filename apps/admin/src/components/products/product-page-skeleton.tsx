import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'

type ProductPageSkeletonProps = {
  /** A new product: only Save in the header, no Preview or More actions. */
  isNew?: boolean
}

/* Five tabs on every product (Overview, Price or Variants, Shipping, SEO, More). */
const TAB_WIDTHS = ['w-20', 'w-24', 'w-20', 'w-12', 'w-14'] as const

/**
 * The product page while its route loads (`products/[id]` and `products/new`), built from the
 * loaded page's parts: the detail shell, the header with the photo tile and its buttons, the
 * underline tab strip (2.75rem, hairline under it) with the tab's one-line description, the
 * Overview tab's cards and the side column's cards.
 */
export default function ProductPageSkeleton({ isNew = false }: ProductPageSkeletonProps) {
  // Render logic
  const tabs = (
    <div className="flex h-11 items-center gap-5 border-border border-b" aria-hidden="true">
      {TAB_WIDTHS.map((w, i) => (
        <Skeleton key={`tab-${i.toString()}`} className={`h-3.5 ${w}`} />
      ))}
    </div>
  )

  return (
    <ProoflyDetailPage
      header={<PageHeaderSkeleton back lead actions={isNew ? 1 : 3} />}
      main={
        <div className="flex min-w-0 flex-col gap-6">
          {tabs}
          <span className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-72 max-w-full" />
          </span>
          <DataCardSkeleton fields={1} lines={1} />
          <DataCardSkeleton fields={3} />
        </div>
      }
      side={
        <>
          <DataCardSkeleton fields={1} />
          <DataCardSkeleton fields={0} lines={2} />
          <DataCardSkeleton fields={1} />
        </>
      }
    />
  )
}
