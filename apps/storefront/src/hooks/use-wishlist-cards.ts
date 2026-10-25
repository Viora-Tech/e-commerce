'use client'

import { type CardProduct, useWishlist } from '@commerce/blocks'
import { useEffect, useState } from 'react'
import { wishlistCardsAction } from '@/lib/wishlist-actions'

/** The cards for the products saved on this device; null while they load. */
export function useWishlistCards(): CardProduct[] | null {
  // One string, so the fetch reruns only when the list itself changes.
  const key = useWishlist().join('|')
  const [cards, setCards] = useState<CardProduct[] | null>(null)

  useEffect(() => {
    let live = true
    const list = key ? key.split('|') : []
    if (list.length === 0) {
      setCards([])
      return
    }
    wishlistCardsAction(list).then(
      (found) => live && setCards(found),
      () => live && setCards([]),
    )
    return () => {
      live = false
    }
  }, [key])

  return cards
}
