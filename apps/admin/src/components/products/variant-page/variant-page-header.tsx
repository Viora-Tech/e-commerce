'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import { Package, Trash2 } from '@commerce/ui/icons'
import ActionMenu from '@/components/layout/action-menu'
import FallbackImage from '@/components/layout/fallback-image'
import PageHeader from '@/components/layout/page-header'
import OrderChip from '@/components/orders/order-chip'
import { variantPageContent } from '@/data/variant-page'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type VariantPageHeaderProps = {
  productId: string
  productTitle: string
  /** The product's status: a variant sells only while its product is active. */
  status: ProductStatus
  /** The variant's title ("60% / Black"). */
  title: string
  summary: string
  /** The variant's main image, or the product's cover. */
  imageUrl: string | undefined
  busy: boolean
  dirty: boolean
  /** Off for the product's only variant. */
  canDelete: boolean
  onSave: () => void
  onDelete: () => void
}

/** "‹ <product>" back to the product, the variant's image and title, the product's status chip,
 *  More actions (Delete variant) and Save. */
export default function VariantPageHeader({
  productId,
  productTitle,
  status,
  title,
  summary,
  imageUrl,
  busy,
  dirty,
  canDelete,
  onSave,
  onDelete,
}: VariantPageHeaderProps) {
  // Hooks
  const copy = useCopy(variantPageContent)

  // Render logic
  return (
    <PageHeader
      title={title}
      back={{ label: copy.back(productTitle), href: routes.products.detail(productId) }}
      lead={{
        kind: 'tile',
        node: (
          <FallbackImage
            src={imageUrl}
            fallback={<Package aria-hidden="true" />}
            className="size-full bg-card object-cover"
          />
        ),
      }}
      badges={<OrderChip kind="product" value={status} />}
      summary={summary}
      actions={
        <ActionMenu
          label={copy.moreActions}
          trigger="button"
          disabled={busy}
          items={[
            {
              label: canDelete ? copy.delete.action : copy.delete.onlyOne,
              icon: Trash2,
              destructive: true,
              disabled: !canDelete,
              onSelect: onDelete,
            },
          ]}
        />
      }
      save={{ dirty, saving: busy, onSave }}
    />
  )
}
