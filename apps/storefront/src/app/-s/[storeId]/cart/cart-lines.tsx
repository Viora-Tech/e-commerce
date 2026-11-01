'use client'

import { QuantityInput, useFormatCart } from '@commerce/blocks'
import type { CartLineView } from '@commerce/core'
import { type CSSProperties, useTransition } from 'react'
import { cartContent as content } from '@/data/cart'
import { setQuantityAction } from '@/lib/cart-actions'

/** A pre-order campaign's badge colours (#144), already checked as hex; the theme's without. */
function badgeLook(l: CartLineView): { className: string; style: CSSProperties | undefined } {
  const c = l.preorderColours
  if (!c?.badgeBackground && !c?.badgeText) return { className: '', style: undefined }
  return {
    className: [
      c.badgeBackground ? 'bg-(--preorder-badge-bg)' : '',
      c.badgeText ? 'text-(--preorder-badge-text)' : '',
    ].join(' '),
    style: {
      ...(c.badgeBackground ? { '--preorder-badge-bg': c.badgeBackground } : {}),
      ...(c.badgeText ? { '--preorder-badge-text': c.badgeText } : {}),
    } as CSSProperties,
  }
}

/**
 * Figma Pages · Cart (704:117993): each line is the thumbnail, the name and variant over the
 * quantity stepper and Remove, and the line total at the right; hairlines between lines.
 */
export default function CartLines({ lines }: { lines: CartLineView[] }) {
  // Hooks
  const money = useFormatCart()
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
              <span
                className={`cart-line__preorder-badge ${badgeLook(l).className}`}
                style={badgeLook(l).style}
              >
                {l.preorderBadge ?? content.preorder}
              </span>
            ) : null}
            {l.preorderNote ? <p className="cart-line__preorder-note">{l.preorderNote}</p> : null}
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
          <span className="cart-line__total-price">{money.line(l)}</span>
        </li>
      ))}
    </ul>
  )
}
