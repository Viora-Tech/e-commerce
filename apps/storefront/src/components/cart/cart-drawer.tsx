'use client'

import { CART_ADDED_EVENT, Icon, useFormatPaise } from '@commerce/blocks'
import { useEffect, useRef, useState, useTransition } from 'react'
import { cartContent as content } from '@/data/cart'
import { cartDrawerAction, setQuantityAction } from '@/lib/cart-actions'
import FreeShippingProgress from './free-shipping-progress'

type Drawer = Awaited<ReturnType<typeof cartDrawerAction>>

type CartDrawerProps = {
  /** Theme settings → Cart → "Free shipping bar". */
  freeShippingBar: boolean
}

/** How long the slide-out runs before the dialog really closes (section-cart.css). */
const CLOSE_MS = 320

/**
 * Theme settings → Cart → Drawer: the header's bag and every add to cart open the cart from the
 * side instead of leaving the page (the theme's own drawer styles, section-cart.css). Quantities
 * change in place; Check out and View cart lead on. Without JavaScript the bag stays a link.
 */
export default function CartDrawer({ freeShippingBar }: CartDrawerProps) {
  // Hooks
  const formatPaise = useFormatPaise()
  const dialog = useRef<HTMLDialogElement>(null)
  const [data, setData] = useState<Drawer | null>(null)
  const [failed, setFailed] = useState(false)
  const [visible, setVisible] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const open = () => {
      setFailed(false)
      const el = dialog.current
      if (el && !el.open) {
        el.showModal()
        document.documentElement.classList.add('cart-drawer-open')
        // The resting transform paints first, so the slide-in has somewhere to start from.
        requestAnimationFrame(() => setVisible(true))
      }
      cartDrawerAction()
        .then(setData)
        .catch(() => setFailed(true))
    }
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('.header__cart-link')
      if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      open()
    }
    document.addEventListener('click', onClick)
    window.addEventListener(CART_ADDED_EVENT, open)
    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener(CART_ADDED_EVENT, open)
    }
  }, [])

  // Event handlers
  const handleClose = () => {
    setVisible(false)
    document.documentElement.classList.remove('cart-drawer-open')
    setTimeout(() => dialog.current?.close(), CLOSE_MS)
  }

  const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault()
    handleClose()
  }

  const handleBackdrop = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) handleClose()
  }

  const handleQuantity = (lineId: string, quantity: number) => {
    startTransition(async () => {
      await setQuantityAction(lineId, quantity)
      setData(await cartDrawerAction())
    })
  }

  // Render logic
  const empty = data !== null && data.lines.length === 0
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes the dialog natively (onCancel)
    <dialog
      ref={dialog}
      className={`cart-drawer${visible ? ' is-visible' : ''}`}
      aria-label={content.title}
      onCancel={handleCancel}
      onClick={handleBackdrop}
    >
      <div className="cart-drawer__content" aria-busy={pending || undefined}>
        <div className="cart-drawer__header">
          <h2 className="cart-drawer__title">
            {content.title}
            {data && data.itemCount > 0 ? (
              <span className="cart-drawer__title-count"> ({data.itemCount})</span>
            ) : null}
          </h2>
          <button
            type="button"
            className="cart-drawer__close"
            aria-label={content.drawer.close}
            onClick={handleClose}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {failed ? (
          <div className="cart-drawer__empty">
            <p className="cart-drawer__empty-text">{content.drawer.failed}</p>
            <a className="btn btn--secondary" href="/cart">
              {content.drawer.viewCart}
            </a>
          </div>
        ) : data === null ? (
          <div className="cart-drawer__empty">
            <p className="cart-drawer__empty-text">{content.drawer.loading}</p>
          </div>
        ) : empty ? (
          <div className="cart-drawer__empty">
            <p className="cart-drawer__empty-heading">{content.empty.heading}</p>
            <p className="cart-drawer__empty-text">{content.empty.body}</p>
            <a className="btn btn--secondary" href="/collections">
              {content.empty.cta}
            </a>
          </div>
        ) : (
          <>
            <div className="cart-drawer__items">
              {freeShippingBar && data.freeAbovePaise !== null ? (
                <FreeShippingProgress
                  thresholdPaise={data.freeAbovePaise}
                  totalPaise={data.subtotalPaise}
                />
              ) : null}
              <ul className="list-unstyled">
                {data.lines.map((l) => (
                  <li key={l.id} className="cart-line">
                    <a href={`/products/${l.handle}`} className="cart-line__image-link">
                      {l.imageUrl ? (
                        // biome-ignore lint/performance/noImgElement: Zero Drift markup, CDN thumbnail.
                        <img className="cart-line__image" src={l.imageUrl} alt="" loading="lazy" />
                      ) : null}
                    </a>
                    <div className="cart-line__info">
                      <a href={`/products/${l.handle}`} className="cart-line__title">
                        {l.title}
                      </a>
                      {l.variantTitle ? (
                        <p className="cart-line__variant">{l.variantTitle}</p>
                      ) : null}
                    </div>
                    <div className="cart-line__quantity quantity-input">
                      <button
                        type="button"
                        className="quantity-input__button"
                        aria-label={content.drawer.decrease(l.title)}
                        disabled={pending}
                        onClick={() => handleQuantity(l.id, l.quantity - 1)}
                      >
                        −
                      </button>
                      <span aria-live="polite">{l.quantity}</span>
                      <button
                        type="button"
                        className="quantity-input__button"
                        aria-label={content.drawer.increase(l.title)}
                        disabled={pending || l.quantity >= l.available}
                        onClick={() => handleQuantity(l.id, l.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <span className="cart-line__total">{formatPaise(l.linePaise)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="cart-drawer__footer">
              <div className="cart-drawer__total">
                <div className="cart-drawer__total-text">
                  <span className="cart-drawer__total-label">{content.subtotal}</span>
                  <span className="cart-drawer__total-note">{content.taxesAtCheckout}</span>
                </div>
                <span className="cart-drawer__total-amount">{formatPaise(data.subtotalPaise)}</span>
              </div>
              <a className="btn btn--primary" href="/checkout">
                {content.checkout}
              </a>
              <a className="btn btn--secondary" href="/cart">
                {content.drawer.viewCart}
              </a>
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}
