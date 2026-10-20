'use client'

import { useState } from 'react'
import { productCardContent as copy } from '../data/product-card'
import { useStoreActions } from '../store-actions'

type ProductCardQuickAddProps = {
  handle: string
  /** The one variant to add; a product with options gets "Choose options" instead. */
  variantId: string | null | undefined
  soldOut: boolean
  /** Set while the product sells as a pre-order: the add button reads this label instead. */
  preorderLabel?: string | null | undefined
}

/**
 * Figma Store / Product card "Quick add": a full-width 40px button under the price. One click
 * adds a single-variant product; a product with options links to its page to choose them.
 */
export default function ProductCardQuickAdd({
  handle,
  variantId,
  soldOut,
  preorderLabel,
}: ProductCardQuickAddProps) {
  // Hooks
  const { addToCart } = useStoreActions()
  const [state, setState] = useState<'idle' | 'adding' | 'added' | 'failed'>('idle')

  // Event handlers
  const handleAdd = async () => {
    if (!variantId || !addToCart) return
    setState('adding')
    try {
      await addToCart(variantId, 1)
      setState('added')
    } catch {
      setState('failed')
    }
  }

  // Derived state
  const idleLabel = preorderLabel || copy.quickAdd

  // Early returns
  if (soldOut) {
    return (
      <button type="button" className="btn btn--secondary product-card__quick-add" disabled>
        {copy.soldOut}
      </button>
    )
  }
  if (!variantId) {
    return (
      <a href={`/products/${handle}`} className="btn btn--secondary product-card__quick-add">
        {copy.chooseOptions}
      </a>
    )
  }

  // Render logic
  return (
    <button
      type="button"
      className="btn btn--primary product-card__quick-add"
      onClick={handleAdd}
      disabled={state === 'adding'}
      aria-live="polite"
    >
      {state === 'added' ? copy.added : state === 'failed' ? copy.failed : idleLabel}
    </button>
  )
}
