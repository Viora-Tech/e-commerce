import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageBody from '@/components/layout/page-body'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import VariantPageColumns from './variant-page-columns'

/* Options, image, pricing, inventory and shipping: the cards every variant has. */
const CARDS = [2, 1, 2, 2, 2] as const

/**
 * The variant page while its route loads (`products/[id]/variants/[variantId]`), built from the
 * loaded page's parts: the 75rem detail shell, the header with the photo tile, More actions and
 * Save, the variant list on the left (a picker on a phone) and the variant's cards on the right.
 */
export default function VariantPageSkeleton() {
  // Render logic
  return (
    <PageBody width="detail">
      <PageHeaderSkeleton back lead actions={2} />
      <VariantPageColumns
        list={
          <>
            <Skeleton className="h-9 w-full lg:hidden" />
            <div className="hidden lg:block">
              <DataCardSkeleton fields={0} lines={4} />
            </div>
          </>
        }
        main={CARDS.map((fields, i) => (
          <DataCardSkeleton key={`card-${i.toString()}`} fields={fields} />
        ))}
      />
    </PageBody>
  )
}
