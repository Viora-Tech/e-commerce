'use client'

import { EmptyState, Icon, ProductCard } from '@commerce/blocks'
import { wishlistContent as copy } from '@/data/wishlist'
import { useWishlistCards } from '@/hooks/use-wishlist-cards'

/**
 * Figma Pages · Wishlist (707:123413): the count, a note that the list lives on this device, then
 * the saved products as cards with Quick add; an empty state when nothing is saved.
 */
export default function WishlistGrid() {
  // Hooks
  const cards = useWishlistCards()

  // Early returns
  if (cards === null) return <p className="wishlist__loading">{copy.loading}</p>
  if (cards.length === 0) {
    return (
      <EmptyState
        icon="heart"
        title={copy.emptyTitle}
        body={copy.emptyBody}
        action={{ label: copy.emptyAction, href: '/collections' }}
      />
    )
  }

  // Render logic
  return (
    <>
      <p className="wishlist__count">{copy.count(cards.length)}</p>
      <div className="wishlist__note">
        <Icon name="question" size={16} />
        <div>
          <p className="wishlist__note-title">{copy.noteTitle}</p>
          <p className="wishlist__note-body">{copy.noteBody}</p>
        </div>
      </div>
      <div className="wishlist__grid">
        {cards.map((p) => (
          <ProductCard key={p.id} product={p} quickAdd />
        ))}
      </div>
    </>
  )
}
