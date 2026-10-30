'use client'

import { type ReactNode, useEffect, useState, useTransition } from 'react'
import { stickyAtcContent as copy } from '../data/zero-drift/sticky-atc'
import { onVariantChange } from '../product-variant-event'
import type { ProductDetail } from '../types'
import Picture from './picture'
import Price from './price'

type StickyAtcProps = {
  product: ProductDetail
  placement: 'corner' | 'bar'
  addLabel: ReactNode
  soldOutLabel: ReactNode
  /** The storefront's add-to-cart action; absent in the Customize canvas (button inert). */
  onAddToCart?: ((variantId: string, quantity: number) => Promise<void>) | undefined
  /** Customize canvas: drawn in place and always visible, so it can be selected. */
  preview: boolean
}

function defaultVariant(product: ProductDetail) {
  return product.variants.find((v) => v.purchasable) ?? product.variants[0]
}

// Port of sections/sticky-atc.liquid + assets/sticky-atc.js: once the main buy buttons
// (`[data-buy-buttons]` in ProductBuyButtons) have scrolled up out of view, a card or bar
// slides in with the product, the selected variant's price and Add to cart. It follows the
// shopper's pick through the `variant:changed` event (`../product-variant-event.ts`), and
// stays hidden on a page without the main buy buttons.
export default function StickyAtc({
  product,
  placement,
  addLabel,
  soldOutLabel,
  onAddToCart,
  preview,
}: StickyAtcProps) {
  // Hooks
  const [variantId, setVariantId] = useState(defaultVariant(product)?.id)
  const [shown, setShown] = useState(false)
  const [visible, setVisible] = useState(false)
  const [added, setAdded] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => onVariantChange(product.id, setVariantId), [product.id])

  useEffect(() => {
    if (preview) return
    const anchor = document.querySelector('[data-buy-buttons]')
    if (!anchor || !('IntersectionObserver' in window)) return
    let frame = 0
    const observer = new IntersectionObserver(([entry]) => {
      const passedAbove =
        Boolean(entry) && !entry?.isIntersecting && (entry?.boundingClientRect.top ?? 0) < 0
      cancelAnimationFrame(frame)
      setShown(passedAbove)
      // A frame after un-hiding, so the slide-up has a start state to animate from.
      if (passedAbove) frame = requestAnimationFrame(() => setVisible(true))
      else setVisible(false)
    })
    observer.observe(anchor)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [preview])

  // Event handlers
  const handleAdd = () => {
    if (!variant?.purchasable || !onAddToCart) return
    startTransition(async () => {
      await onAddToCart(variant.id, 1)
      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    })
  }

  // Render logic
  const variant = product.variants.find((v) => v.id === variantId) ?? defaultVariant(product)
  const image = product.images.find((i) => !i.contentType?.startsWith('video/'))
  const open = preview || shown
  const className = `sticky-atc sticky-atc--${placement}${preview ? ' sticky-atc--preview' : ''}${preview || visible ? ' is-visible' : ''}`

  return (
    <aside className={className} hidden={!open} aria-label={product.title}>
      <div className="sticky-atc__inner">
        <a className="sticky-atc__link" href={`/products/${product.handle}`}>
          {image ? (
            <Picture
              image={image}
              alt={image.alt ?? ''}
              className="sticky-atc__image"
              width={56}
              height={56}
              placeholder={false}
              loading="lazy"
              sizes="3.5rem"
            />
          ) : null}
          <span className="sticky-atc__text">
            <span className="sticky-atc__title text-small">{product.title}</span>
            <span className="sticky-atc__variant text-caption">
              {product.variants.length > 1 ? variant?.title : null}
            </span>
            {variant ? (
              <span className="sticky-atc__price">
                <Price
                  pricePaise={variant.pricePaise}
                  mrpPaise={variant.mrpPaise}
                  variantId={variant.id}
                />
              </span>
            ) : null}
          </span>
        </a>
        <button
          type="button"
          className={`btn btn--primary sticky-atc__submit${pending ? ' is-loading' : ''}`}
          disabled={!variant?.purchasable || pending || !onAddToCart}
          onClick={handleAdd}
        >
          <span>{!variant?.purchasable ? soldOutLabel : added ? copy.added : addLabel}</span>
        </button>
      </div>
    </aside>
  )
}
