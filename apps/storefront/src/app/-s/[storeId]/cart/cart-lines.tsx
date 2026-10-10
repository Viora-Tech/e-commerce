'use client'

import { formatPaise } from '@commerce/blocks'
import type { CartLineView } from '@commerce/core'
import { useTransition } from 'react'
import { setQuantityAction } from '@/lib/cart-actions'

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
              <p className="cart-line__variant text-small">{l.variantTitle}</p>
            ) : null}
            {l.preorder ? <span className="cart-line__preorder-badge">Pre-order</span> : null}
            <p className="cart-line__unit-price text-small">{formatPaise(l.unitPricePaise)} each</p>
            <button
              type="button"
              className="cart-line__remove text-small"
              onClick={() => set(l.id, 0)}
            >
              Remove
            </button>
          </div>
          <div className="cart-line__quantity">
            <div className="quantity">
              <button
                type="button"
                className="quantity__button"
                aria-label="Decrease"
                onClick={() => set(l.id, l.quantity - 1)}
              >
                −
              </button>
              <input
                className="quantity__input"
                type="number"
                readOnly
                value={l.quantity}
                aria-label="Quantity"
              />
              <button
                type="button"
                className="quantity__button"
                aria-label="Increase"
                disabled={l.quantity >= l.available}
                onClick={() => set(l.id, l.quantity + 1)}
              >
                +
              </button>
            </div>
          </div>
          <div className="cart-line__total">
            <span className="cart-line__total-price">{formatPaise(l.linePaise)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
