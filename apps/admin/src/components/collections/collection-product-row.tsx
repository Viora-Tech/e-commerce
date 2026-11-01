'use client'

import { X } from '@commerce/ui/icons'
import Link from 'next/link'
import type { ReactNode } from 'react'
import OrderChip from '@/components/orders/order-chip'
import ProductThumb from '@/components/products/product-thumb'
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
  /** Its place in the whole collection (1 is first), shown in a manual order. */
  position?: number | undefined
  /** Opens "Move to position", which can cross pages where dragging cannot. */
  onMove?: (() => void) | undefined
}

/** Shared grid of the products table, so the header and every row line up. */
export const COLLECTION_PRODUCT_GRID =
  'grid grid-cols-[1.5rem_minmax(0,1fr)_6.5rem_7rem_8rem_2rem] items-center gap-3'

/** One product row of a collection: grip, thumbnail and title, status, stock, price, open and menu. */
export default function CollectionProductRow({
  product,
  handle,
  onRemove,
  position,
  onMove,
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
        {position !== undefined ? (
          onMove ? (
            <button
              type="button"
              onClick={onMove}
              aria-label={copy.move.button(position, product.title)}
              title={copy.move.title(product.title)}
              className="w-8 shrink-0 rounded-md py-1 text-center text-caption text-muted-foreground tabular-nums transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {position}
            </button>
          ) : (
            <span className="w-8 shrink-0 text-center text-caption text-muted-foreground tabular-nums">
              {position}
            </span>
          )
        ) : null}
        <ProductThumb url={product.imageUrl} />
        <Link
          href={routes.products.detail(product.id)}
          className="line-clamp-2 text-body text-ink-strong hover:underline"
        >
          {product.title}
        </Link>
      </span>
      <span className="flex justify-center">
        <OrderChip kind="product" value={product.status} />
      </span>
      <span className={product.available > 0 ? 'text-body' : 'text-body text-danger'}>
        {product.available > 0 ? copy.inStock(product.available) : copy.outOfStock}
      </span>
      <span className="text-right text-body tabular-nums">{price}</span>
      <span className="flex justify-end">
        {onRemove ? (
          <button
            type="button"
            aria-label={copy.remove}
            title={copy.remove}
            onClick={onRemove}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </span>
    </div>
  )
}
