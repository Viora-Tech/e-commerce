import type { CardProduct } from '@commerce/blocks'
import { ProductCard } from '@commerce/blocks'
import { collectionsContent as copy } from '@/data/collections'

type CollectionGridProps = { products: CardProduct[] }

/** Glide's product grid, reused for a collection's page and the Puck block. */
export default function CollectionGrid({ products }: CollectionGridProps) {
  // Early returns
  if (products.length === 0) {
    return <p className="text-body collection__empty">{copy.empty}</p>
  }

  // Render logic
  return (
    <div className="collection__grid" data-columns="4">
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} lazy={i > 3} />
      ))}
    </div>
  )
}
