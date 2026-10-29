'use client'

import { formatCountdown, formatInZone } from '@commerce/dates'
import { type ComponentType, useState, useTransition } from 'react'
import { mainProductContent as copy } from '../data/zero-drift/main-product'
import { useFormatPaise } from '../money-format'
import { safeHref } from '../slot-types'
import { announceCartAdded, trackCommerce } from '../store-actions'
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
// notes (ship date, deposit split) and, for a sold-out variant, the theme's sold-out panel
// (snippets/product-notify) with the back-in-stock form in place of the buttons. Laid out
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
  const formatPaise = useFormatPaise()
  const [pending, startTransition] = useTransition()
  const [added, setAdded] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const reduceMotion = useReducedMotion()

  // Helpers
  // The most the picker allows: stock, or on a pre-order with a limit the stock plus the room left.
  const quantityCap = (): number | undefined => {
    if (!variant) return undefined
    if (isPreorder) {
      return variant.preorderRoom == null
        ? undefined
        : Math.max(1, variant.available + variant.preorderRoom)
    }
    return variant.available > 0 && variant.available < 999 ? variant.available : undefined
  }
  // A quantity picked on another variant never goes past this one's cap.
  const pickedQuantity = () => Math.min(quantity, quantityCap() ?? quantity)

  const reportAdd = (variantId: string, pricePaise: number | null) =>
    trackCommerce({
      name: 'AddToCart',
      productId: product.id,
      variantId,
      valuePaise: (pricePaise ?? 0) * pickedQuantity(),
      numItems: pickedQuantity(),
    })

  // Event handlers
  const handleAdd = () => {
    if (!variant || !onAddToCart) return
    startTransition(async () => {
      await onAddToCart(variant.id, pickedQuantity())
      reportAdd(variant.id, variant.pricePaise)
      announceCartAdded()
      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    })
  }

  const handleBuyNow = () => {
    if (!variant || !onAddToCart) return
    startTransition(async () => {
      await onAddToCart(variant.id, pickedQuantity())
      reportAdd(variant.id, variant.pricePaise)
      window.location.assign('/checkout')
    })
  }

  // Render logic
  const launching = countdown > 0
  const preorder = product.preorder
  const deposit = isPreorder ? preorder?.depositPreview : null
  // Listed before its price is set (#913): not sold, and not "sold out" either.
  const unpriced = variant != null && variant.pricePaise == null
  const buyLabel = launching
    ? ui.launchingIn(formatCountdown(countdown))
    : unpriced
      ? ui.priceComingSoon
      : !variant?.purchasable
        ? ui.soldOut
        : added
          ? ui.added
          : isPreorder
            ? (preorder?.buttonLabel ?? ui.preorderLabel)
            : ui.addToCart
  // Sold out and not on pre-order: the panel takes the buy buttons' place (the theme's
  // snippets/product-notify), with the back-in-stock form when the app is installed.
  const soldOut =
    Boolean(variant) && !variant?.purchasable && !isPreorder && !launching && !unpriced
  const allSoldOut = soldOut && product.variants.every((v) => !v.purchasable)
  const notify = soldOut && variant && NotifyMe && notifyMeProps ? variant.id : null
  // The store's pre-order note (#936) says it all under the button, as Shopify's pre-order apps
  // do; "Available for pre-order" stands in only when there is none.
  const preorderNote = isPreorder && !launching ? (preorder?.note ?? null) : null
  const availability = isPreorder
    ? preorderNote
      ? ''
      : ui.availablePreorder
    : !variant || variant.available <= 0
      ? ''
      : stockBarShown
        ? ''
        : variant.available > 5
          ? ui.inStockShips
          : ui.onlyLeft(variant.available)
  // "Only 3 left" is the one availability line that reads as urgent (red); the rest are status.
  const unitsLeft = variant?.available ?? 0
  const lowStock = !isPreorder && !stockBarShown && unitsLeft > 0 && unitsLeft <= 5
  const updatesHref = isPreorder && preorderLink ? safeHref(preorderLink) : null
  // A plain sale (not a launch countdown or a pre-order) gets Buy it now; a pre-order gets the
  // quantity too (#939), capped at the stock and pre-order room left when the limit is set.
  const sellable = Boolean(variant?.purchasable) && !launching && !unpriced
  const buyable = sellable && !isPreorder
  const maxQuantity = quantityCap()

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
      {soldOut ? (
        <div className="product-notify product-notify--sold-out" data-buy-buttons>
          <div className="product-notify__head">
            <span className="status-chip status-chip--out">
              <span className="status-chip__dot" aria-hidden="true" />
              {ui.soldOut}
            </span>
            <p className="product-notify__heading h4">{ui.soldOutHeading}</p>
            <p className="product-notify__text text-body">
              {notify
                ? allSoldOut
                  ? ui.soldOutAllNotify
                  : ui.soldOutOneNotify
                : allSoldOut
                  ? ui.soldOutAll
                  : ui.soldOutOne}
            </p>
          </div>
          {notify && NotifyMe && notifyMeProps ? (
            <NotifyMe key={notify} variantId={notify} {...notifyMeProps} />
          ) : null}
        </div>
      ) : (
        <div className="buy-buttons" data-buy-buttons>
          <div className="buy-buttons__row">
            {sellable ? (
              <QuantityInput
                value={pickedQuantity()}
                onChange={setQuantity}
                max={maxQuantity}
                disabled={pending}
                className="buy-buttons__quantity"
              />
            ) : null}
            <button
              type="button"
              className={`btn ${buyable ? 'btn--secondary' : 'btn--primary'} buy-buttons__submit${pending ? ' is-loading' : ''}${isPreorder ? ' buy-buttons__submit--preorder' : ''}`}
              disabled={!variant?.purchasable || unpriced || launching || pending || !onAddToCart}
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
      )}
      {preorderNote ? (
        <p className="product-info__preorder-note text-small">{preorderNote}</p>
      ) : null}
      {!launching && variant && availability ? (
        <p
          className={`buy-buttons__availability text-small${lowStock ? ' buy-buttons__availability--low' : ''}`}
        >
          {availability}
        </p>
      ) : null}
      {updatesHref ? (
        <a href={updatesHref} className="product-info__preorder-link text-small">
          {ui.preorderUpdates}
          <Icon name="arrow" size={14} />
        </a>
      ) : null}
    </div>
  )
}
