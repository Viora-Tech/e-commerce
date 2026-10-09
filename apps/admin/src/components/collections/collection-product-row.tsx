'use client'

import { ArrowRight } from '@commerce/ui/icons'
import type { ReactNode } from 'react'
import StatusChip from '@/components/layout/status-chip'
import ProductThumb from '@/components/products/product-thumb'
import RowMenu from '@/components/table/row-menu'
import { collectionDetailContent } from '@/data/collections'
import { productsListContent } from '@/data/products'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { PickedProduct } from './form-state'

type CollectionProductRowProps = {
  product: PickedProduct
  /** The drag grip (manual collections); automatic rows leave this out. */
  handle?: ReactNode
  /** Manual collections can drop a product from the list. */
  onRemove?: (() => void) | undefined
}

/** Shared grid of the products table, so the header and every row line up. */
export const COLLECTION_PRODUCT_GRID =
  'grid grid-cols-[1.5rem_minmax(0,1fr)_6rem_6.5rem_8rem_4.5rem] items-center gap-3'

/** One product row of a collection: grip, thumbnail and title, status, stock, price, open and menu. */
export default function CollectionProductRow({
  product,
  handle,
  onRemove,
}: CollectionProductRowProps) {
  // Hooks
  const { products: copy } = useCopy(collectionDetailContent)
  const list = useCopy(productsListContent)
  const fmt = useFormat()

  // Render logic
  const price =
    product.pricePaiseMin === null
      ? ''
      : product.pricePaiseMax === null || product.pricePaiseMax === product.pricePaiseMin
        ? fmt.money(product.pricePaiseMin)
        : list.priceRange(fmt.money(product.pricePaiseMin), fmt.money(product.pricePaiseMax))

  return (
    <div className={`${COLLECTION_PRODUCT_GRID} group/row min-h-14 bg-card px-4 py-2`}>
      <span className="flex justify-center">{handle}</span>
      <span className="flex min-w-0 items-center gap-3">
        <ProductThumb url={product.imageUrl} />
        <span className="line-clamp-2 text-body text-ink-strong">{product.title}</span>
      </span>
      <span className="flex justify-center">
        <StatusChip tone={product.status === 'draft' ? 'info' : 'neutral'}>
          {list.status[product.status]}
        </StatusChip>
      </span>
      <span className={product.available > 0 ? 'text-body' : 'text-body text-danger'}>
        {product.available > 0 ? copy.inStock(product.available) : copy.outOfStock}
      </span>
      <span className="text-right text-body font-medium tabular-nums">{price}</span>
      <span className="flex items-center justify-end gap-0.5 opacity-40 transition-opacity duration-150 group-hover/row:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
        <a
          href={routes.products.detail(product.id)}
          target="_blank"
          rel="noreferrer"
          aria-label={copy.open}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowRight className="size-4" aria-hidden />
        </a>
        {onRemove ? (
          <RowMenu items={[{ label: copy.remove, destructive: true, onSelect: onRemove }]} />
        ) : null}
      </span>
    </div>
  )
}
