import { customSectionsContent as copy } from '../../data/custom-sections'
import type { CardProduct } from '../../types'
import ProductCard from '../product-card'
import ElementBox from './element-box'

export type ProductCardElementProps = {
  productHandle: string
  resolved?: CardProduct | null | undefined
  style: unknown
}

/** One product as the theme's product card, loaded by handle (resolveData). */
export default function ProductCardElement({ resolved, style }: ProductCardElementProps) {
  // Render logic
  return (
    <ElementBox look={style} className="custom-product-card">
      {resolved ? (
        <ProductCard product={resolved} />
      ) : (
        <div className="flex aspect-[3/4] items-center justify-center bg-[var(--color-surface)] text-sm text-[var(--color-muted)]">
          {copy.empty.product}
        </div>
      )}
    </ElementBox>
  )
}
