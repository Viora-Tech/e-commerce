'use client'

import { productCardContent as copy } from '../data/product-card'
import { toggleWishlist, useWishlist } from '../wishlist'
import Icon from './icon'

/**
 * Figma Store / Product card "Wishlist": a 36px round button on the photo's top-right corner, an
 * outline heart that fills once the product is saved.
 */
export default function ProductCardWishlist({ handle, title }: { handle: string; title: string }) {
  // Hooks
  const saved = useWishlist().includes(handle)

  // Render logic
  return (
    <button
      type="button"
      className="product-card__wishlist"
      aria-pressed={saved}
      aria-label={saved ? copy.unsave(title) : copy.save(title)}
      onClick={() => toggleWishlist(handle)}
    >
      <Icon name={saved ? 'heart-filled' : 'heart'} size={18} />
    </button>
  )
}
