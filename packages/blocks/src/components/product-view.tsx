'use client'

import {
  parseRichText,
  plainTextToRichText,
  RichTextRenderer,
  richTextToPlainText,
} from '@commerce/richtext'
import { type ComponentType, type ReactNode, useEffect, useState, useTransition } from 'react'
import type { MediaImage, ProductDetail } from '../types'
import { useReducedMotion } from '../use-reduced-motion'
import Picture from './picture'
import Price from './price'

/** Imported products hold a plain string; the admin editor writes Lexical JSON. */
function descriptionDoc(raw: ProductDetail['description']) {
  const doc = parseRichText(raw)
  if (doc) return doc
  return typeof raw === 'string' && raw.trim() ? plainTextToRichText(raw) : null
}

const isVideo = (img: { contentType?: string | null | undefined }) =>
  img.contentType?.startsWith('video/') ?? false

/** A thumbnail is at most 120px wide (240 on a 2x screen): the smallest variant, not the original. */
const thumbSrc = (img: MediaImage) => img.variants?.['320']?.webp ?? img.url

function defaultVariant(product: ProductDetail) {
  return product.variants.find((v) => v.purchasable) ?? product.variants[0]
}

/** Milliseconds until `launchAt`, clamped to zero; used for the "Launching in…" label and countdown. */
function msUntilLaunch(launchAt: string | null | undefined): number {
  if (!launchAt) return 0
  return Math.max(0, new Date(launchAt).getTime() - Date.now())
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function slideFor(product: ProductDetail, variant: ProductDetail['variants'][number] | undefined) {
  return Math.max(
    0,
    product.images.findIndex((i) => i.url === variant?.imageUrl),
  )
}

// Port of sections/main-product.liquid with snippets/product-gallery,
// variant-picker and buy-buttons. Cart wiring comes with the cart PR.
export default function ProductView({
  product,
  onAddToCart,
  UnderPrice,
  belowBuy,
  NotifyMe,
  notifyMeProps,
}: {
  product: ProductDetail
  onAddToCart?: ((variantId: string, quantity: number) => Promise<void>) | undefined
  /** Rendered below the price with the selected variant's price (EMI hint, offers). */
  UnderPrice?: ComponentType<{ pricePaise: number }> | undefined
  /** Rendered under the buy buttons (delivery estimate). */
  belowBuy?: ReactNode
  /**
   * The back-in-stock "notify me" form, shown only for the selected variant
   * while it is sold out and not on pre-order; omitted when the app is not
   * installed for this store. Follows variant switching (keyed by variant id,
   * so its own state resets when the shopper picks a different one).
   */
  NotifyMe?: ComponentType<{ variantId: string; whatsappEnabled: boolean }> | undefined
  /** Server-resolved data `NotifyMe` needs beyond the selected variant id. */
  notifyMeProps?: { whatsappEnabled: boolean } | undefined
}) {
  // Hooks
  const [pending, startTransition] = useTransition()
  const [added, setAdded] = useState(false)
  const [variantId, setVariantId] = useState(defaultVariant(product)?.id)
  const [slide, setSlide] = useState(() => slideFor(product, defaultVariant(product)))
  const [expanded, setExpanded] = useState(false)
  const [countdown, setCountdown] = useState(() => msUntilLaunch(product.launchAt))
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (countdown <= 0) return
    // A minute-granularity label doesn't need a per-second tick; this also
    // keeps the interval trivial to skip under reduced motion (it still
    // needs to run so the button unlocks at launch, just with no animation).
    const id = setInterval(() => setCountdown(msUntilLaunch(product.launchAt)), 30_000)
    return () => clearInterval(id)
  }, [countdown, product.launchAt])

  // Event handlers
  const handlePick = (id: string) => {
    setVariantId(id)
    const v = product.variants.find((x) => x.id === id)
    const idx = product.images.findIndex((i) => i.url === v?.imageUrl)
    if (idx >= 0) setSlide(idx)
  }

  // Render logic
  const firstAvailable = defaultVariant(product)
  const variant = product.variants.find((v) => v.id === variantId) ?? firstAvailable
  const selectedValues = new Set(variant?.optionValueIds ?? [])
  const description = descriptionDoc(product.description)
  const longDescription = description ? richTextToPlainText(description).length > 280 : false
  const clamped = longDescription && !expanded
  const launching = countdown > 0
  const isPreorder = Boolean(product.preorder?.enabled) && (!variant || variant.available <= 0)
  const buyLabel = launching
    ? `Launching in ${formatCountdown(countdown)}`
    : !variant?.purchasable
      ? 'Sold out'
      : added
        ? 'Added'
        : isPreorder
          ? (product.preorder?.buttonLabel ?? 'Pre-order')
          : 'Add to cart'

  return (
    <section className="section-product page-width">
      <div className="product-layout">
        <div className="product-layout__gallery">
          <div className="product-gallery">
            <div className="product-gallery__stage">
              <div className="product-gallery__main">
                {product.images.map((img, i) => (
                  <div
                    key={img.url}
                    className={`product-gallery__slide${i === slide ? ' is-active' : ''}`}
                    hidden={i !== slide}
                  >
                    {isVideo(img) ? (
                      <video
                        src={img.url}
                        controls
                        muted
                        playsInline
                        preload={i === 0 ? 'metadata' : 'none'}
                        aria-label={img.alt ?? product.title}
                      />
                    ) : (
                      <Picture
                        image={img}
                        alt={img.alt ?? product.title}
                        width={1200}
                        height={1200}
                        fill
                        loading={i === 0 ? 'eager' : 'lazy'}
                        fetchPriority={i === 0 ? 'high' : undefined}
                        sizes="(min-width: 990px) 55vw, 100vw"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            {product.images.length > 1 ? (
              <div className="product-gallery__thumbs">
                {product.images.map((img, i) => (
                  <button
                    key={img.url}
                    type="button"
                    className={`product-gallery__thumb${i === slide ? ' is-active' : ''}`}
                    aria-label={`Image ${i + 1}`}
                    aria-current={i === slide}
                    onClick={() => setSlide(i)}
                  >
                    {isVideo(img) ? (
                      <video src={img.url} muted playsInline preload="metadata" />
                    ) : (
                      <img src={thumbSrc(img)} alt="" width={120} height={120} loading="lazy" />
                    )}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="product-layout__info">
          {product.vendor ? <p className="text-caption">{product.vendor}</p> : null}
          <h1 className="product-info__title h2">
            {product.title}
            {product.preorder?.enabled ? (
              <span className="product-info__preorder-badge">Pre-order</span>
            ) : null}
          </h1>
          {variant ? (
            <div className="product-info__price product-info__price--large">
              <Price pricePaise={variant.pricePaise} mrpPaise={variant.mrpPaise} />
              <p className="text-caption">Inclusive of all taxes</p>
              {UnderPrice ? <UnderPrice pricePaise={variant.pricePaise} /> : null}
            </div>
          ) : null}

          {product.options.map((o) => (
            <fieldset key={o.id} className="variant-picker__option">
              <legend className="variant-picker__option-header">
                <span className="variant-picker__option-name">{o.name}</span>
                <span className="variant-picker__option-value">
                  {o.values.find((v) => selectedValues.has(v.id))?.value}
                </span>
              </legend>
              <div className="variant-picker__values">
                {o.values.map((val) => {
                  const target = product.variants.find((v) => v.optionValueIds.includes(val.id))
                  const unavailable = !target?.purchasable
                  return (
                    <label
                      key={val.id}
                      className={`variant-picker__pill${unavailable ? ' is-unavailable' : ''}`}
                    >
                      <input
                        type="radio"
                        className="visually-hidden variant-picker__radio"
                        name={o.id}
                        value={val.id}
                        checked={selectedValues.has(val.id)}
                        onChange={() => target && handlePick(target.id)}
                      />
                      {val.value}
                    </label>
                  )
                })}
              </div>
            </fieldset>
          ))}

          <div className="product-info__buy">
            {launching ? (
              <p
                className={`product-info__launch text-small${reduceMotion ? '' : ' product-info__launch--animate'}`}
                aria-live="polite"
              >
                Launches{' '}
                {new Date(product.launchAt as string).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'Asia/Kolkata',
                })}
              </p>
            ) : null}
            {isPreorder && product.preorder?.shipDate ? (
              <p className="product-info__preorder-ship text-small">
                Expected to ship{' '}
                {new Date(product.preorder.shipDate).toLocaleDateString('en-IN', {
                  dateStyle: 'medium',
                })}
              </p>
            ) : null}
            {isPreorder && product.preorder?.depositPreview ? (
              <p className="product-info__preorder-deposit text-small">
                Pay ₹{(product.preorder.depositPreview.payNowPaise / 100).toFixed(2)} now, ₹
                {(product.preorder.depositPreview.payLaterPaise / 100).toFixed(2)} later
              </p>
            ) : null}
            {isPreorder &&
            product.preorder?.depositPreview &&
            product.preorder.nonRefundableDepositDays ? (
              <p className="product-info__preorder-deposit text-small">
                The deposit is non-refundable if the balance is not paid within{' '}
                {product.preorder.nonRefundableDepositDays} days of our request.
              </p>
            ) : null}
            <div className="buy-buttons__row">
              <button
                type="button"
                className={`btn btn--primary buy-buttons__submit${pending ? ' is-loading' : ''}${isPreorder ? ' buy-buttons__submit--preorder' : ''}`}
                disabled={!variant?.purchasable || launching || pending || !onAddToCart}
                onClick={() => {
                  if (!variant || !onAddToCart) return
                  startTransition(async () => {
                    await onAddToCart(variant.id, 1)
                    setAdded(true)
                    setTimeout(() => setAdded(false), 2000)
                  })
                }}
              >
                <span className="btn__label">{buyLabel}</span>
              </button>
              {added ? (
                <a href="/cart" className="btn btn--secondary">
                  View cart
                </a>
              ) : null}
            </div>
            {!launching && variant ? (
              <p className="buy-buttons__availability text-small">
                {isPreorder
                  ? 'Available for pre-order'
                  : variant.available > 5
                    ? 'In stock, ships today if ordered before 12 pm'
                    : variant.available > 0
                      ? `Only ${variant.available} left`
                      : NotifyMe && notifyMeProps
                        ? ''
                        : 'Notify me when back'}
              </p>
            ) : null}
            {!launching &&
            !isPreorder &&
            variant &&
            variant.available <= 0 &&
            NotifyMe &&
            notifyMeProps ? (
              <NotifyMe key={variant.id} variantId={variant.id} {...notifyMeProps} />
            ) : null}
            {belowBuy}
          </div>

          {description ? (
            <div
              className={`product-info__description text-body rte${clamped ? ' product-info__description--clamped' : ''}`}
            >
              <div className="product-info__description-body">
                <RichTextRenderer data={description} />
              </div>
              {longDescription ? (
                <button
                  type="button"
                  className="product-info__read-more"
                  onClick={() => setExpanded((e) => !e)}
                >
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
