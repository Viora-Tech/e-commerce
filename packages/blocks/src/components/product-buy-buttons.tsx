'use client'

import { formatCountdown, formatInZone } from '@commerce/dates'
import { type ComponentType, useState, useTransition } from 'react'
import { mainProductContent as copy } from '../data/zero-drift/main-product'
import { formatPaise } from '../money'
import { safeHref } from '../slot-types'
import type { ProductDetail } from '../types'
import { useReducedMotion } from '../use-reduced-motion'
import Icon from './icon'
import QuantityInput from './quantity-input'

type ProductBuyButtonsProps = {
  product: ProductDetail
  variant: ProductDetail['variants'][number] | undefined
  /** Milliseconds until launch; above zero the button is locked with a countdown. */
  countdown: number
  isPreorder: boolean
  onAddToCart?: ((variantId: string, quantity: number) => Promise<void>) | undefined
  NotifyMe?: ComponentType<{ variantId: string; whatsappEnabled: boolean }> | undefined
  notifyMeProps?: { whatsappEnabled: boolean } | undefined
  /** With the stock bar on, the in-stock lines are its job; this keeps only sold-out/pre-order. */
  stockBarShown: boolean
  /** The pre-order updates page, linked under the button on a pre-order; null hides it. */
  preorderLink: string | null
}

const ui = copy.ui

// The `buy_buttons` block: snippets/buy-buttons.liquid plus our launch countdown, pre-order
// notes (ship date, deposit split) and the back-in-stock form for a sold-out variant. Laid out
// as Figma Section / Product (705:122778): the quantity beside an outline Add to cart, then a
// full-width Buy it now that adds and goes straight to checkout.
export default function ProductBuyButtons({
  product,
  variant,
  countdown,
  isPreorder,
  onAddToCart,
  NotifyMe,
  notifyMeProps,
  stockBarShown,
  preorderLink,
}: ProductBuyButtonsProps) {
  // Hooks
  const [pending, startTransition] = useTransition()
  const [added, setAdded] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const reduceMotion = useReducedMotion()

  // Event handlers
  const handleAdd = () => {
    if (!variant || !onAddToCart) return
    startTransition(async () => {
      await onAddToCart(variant.id, quantity)
      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    })
  }

  const handleBuyNow = () => {
    if (!variant || !onAddToCart) return
    startTransition(async () => {
      await onAddToCart(variant.id, quantity)
      window.location.assign('/checkout')
    })
  }

  // Render logic
  const launching = countdown > 0
  const preorder = product.preorder
  const deposit = isPreorder ? preorder?.depositPreview : null
  const buyLabel = launching
    ? ui.launchingIn(formatCountdown(countdown))
    : !variant?.purchasable
      ? ui.soldOut
      : added
        ? ui.added
        : isPreorder
          ? (preorder?.buttonLabel ?? ui.preorderLabel)
          : ui.addToCart
  const soldOut = Boolean(variant) && !isPreorder && (variant?.available ?? 0) <= 0
  const notify = !launching && soldOut && variant && NotifyMe && notifyMeProps
  const availability = isPreorder
    ? ui.availablePreorder
    : !variant || variant.available <= 0
      ? notify
        ? ''
        : ui.notifyWhenBack
      : stockBarShown
        ? ''
        : variant.available > 5
          ? ui.inStockShips
          : ui.onlyLeft(variant.available)
  const updatesHref = isPreorder && preorderLink ? safeHref(preorderLink) : null
  // A plain sale (not a launch countdown or a pre-order) gets the quantity and Buy it now.
  const buyable = Boolean(variant?.purchasable) && !launching && !isPreorder

  return (
    <div className="product-info__buy">
      {launching ? (
        <p
          className={`product-info__launch text-small${reduceMotion ? '' : ' product-info__launch--animate'}`}
          aria-live="polite"
        >
          {ui.launches}{' '}
          {formatInZone(product.launchAt as string, { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      ) : null}
      {isPreorder && preorder?.shipDate ? (
        <p className="product-info__preorder-ship text-small">
          {ui.expectedToShip} {formatInZone(preorder.shipDate, { dateStyle: 'medium' })}
        </p>
      ) : null}
      {deposit ? (
        <p className="product-info__preorder-deposit text-small">
          {ui.deposit(formatPaise(deposit.payNowPaise), formatPaise(deposit.payLaterPaise))}
        </p>
      ) : null}
      {deposit && preorder?.nonRefundableDepositDays ? (
        <p className="product-info__preorder-deposit text-small">
          {ui.nonRefundable(preorder.nonRefundableDepositDays)}
        </p>
      ) : null}
      <div className="buy-buttons" data-buy-buttons>
        <div className="buy-buttons__row">
          {buyable ? (
            <QuantityInput
              value={quantity}
              onChange={setQuantity}
              max={variant?.available && variant.available < 999 ? variant.available : undefined}
              disabled={pending}
              className="buy-buttons__quantity"
            />
          ) : null}
          <button
            type="button"
            className={`btn ${buyable ? 'btn--secondary' : 'btn--primary'} buy-buttons__submit${pending ? ' is-loading' : ''}${isPreorder ? ' buy-buttons__submit--preorder' : ''}`}
            disabled={!variant?.purchasable || launching || pending || !onAddToCart}
            onClick={handleAdd}
          >
            <span className="btn__label">{buyLabel}</span>
          </button>
        </div>
        {buyable ? (
          <button
            type="button"
            className="btn btn--primary buy-buttons__buy-now"
            disabled={pending || !onAddToCart}
            onClick={handleBuyNow}
          >
            <span className="btn__label">{ui.buyNow}</span>
          </button>
        ) : null}
        {added ? (
          <a href="/cart" className="buy-buttons__view-cart text-small">
            {ui.viewCart}
          </a>
        ) : null}
      </div>
      {!launching && variant && availability ? (
        <p className="buy-buttons__availability text-small">{availability}</p>
      ) : null}
      {notify ? <NotifyMe key={variant.id} variantId={variant.id} {...notifyMeProps} /> : null}
      {updatesHref ? (
        <a href={updatesHref} className="product-info__preorder-link text-small">
          {ui.preorderUpdates}
          <Icon name="arrow" size={14} />
        </a>
      ) : null}
    </div>
  )
}
