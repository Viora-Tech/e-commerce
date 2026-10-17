'use client'

import { formatPaise, QuantityInput } from '@commerce/blocks'
import type { CartLineView } from '@commerce/core'
import { useTransition } from 'react'
import { cartContent as content } from '@/data/cart'
import { setQuantityAction } from '@/lib/cart-actions'

/**
 * Figma Pages · Cart (704:117993): each line is the thumbnail, the name and variant over the
 * quantity stepper and Remove, and the line total at the right; hairlines between lines.
 */
export default function CartLines({ lines }: { lines: CartLineView[] }) {
  // Hooks
  const [pending, start] = useTransition()

  // Helpers
  const set = (lineId: string, qty: number) => start(() => setQuantityAction(lineId, qty))

  return (
    <ul className="cart-items__list" aria-busy={pending}>
      {lines.map((l) => (
        <li key={l.id} className="cart-line">
          <a href={`/products/${l.productHandle}`} className="cart-line__image-link">
            {l.imageUrl ? (
              // biome-ignore lint/performance/noImgElement: Zero Drift markup, CDN thumbnail.
              <img className="cart-line__image" src={l.imageUrl} alt="" width={120} height={120} />
            ) : (
              <span className="cart-line__image" />
            )}
          </a>
          <div className="cart-line__info">
            <a href={`/products/${l.productHandle}`} className="cart-line__title">
              {l.productTitle}
            </a>
            {l.variantTitle !== 'Default' ? (
              <p className="cart-line__variant">{l.variantTitle}</p>
            ) : null}
            {l.preorder ? (
              <span className="cart-line__preorder-badge">{content.preorder}</span>
            ) : null}
            <div className="cart-line__actions">
              <QuantityInput
                value={l.quantity}
                onChange={(n) => set(l.id, n)}
                min={1}
                max={l.available}
                disabled={pending}
                className="cart-line__quantity"
              />
              <button type="button" className="cart-line__remove" onClick={() => set(l.id, 0)}>
                {content.remove}
              </button>
            </div>
          </div>
          <span className="cart-line__total-price">{formatPaise(l.linePaise)}</span>
        </li>
      ))}
    </ul>
  )
}
