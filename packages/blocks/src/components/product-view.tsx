'use client'

import {
  parseRichText,
  plainTextToRichText,
  RichTextRenderer,
  richTextToPlainText,
} from '@commerce/richtext'
import { type ComponentType, type ReactNode, useState, useTransition } from 'react'
import type { ProductDetail } from '../types'
import Price from './price'

/** Imported products hold a plain string; the admin editor writes Lexical JSON. */
function descriptionDoc(raw: ProductDetail['description']) {
  const doc = parseRichText(raw)
  if (doc) return doc
  return typeof raw === 'string' && raw.trim() ? plainTextToRichText(raw) : null
}

const isVideo = (img: { contentType?: string | null | undefined }) =>
  img.contentType?.startsWith('video/') ?? false

function defaultVariant(product: ProductDetail) {
  return product.variants.find((v) => v.available > 0) ?? product.variants[0]
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
}: {
  product: ProductDetail
  onAddToCart?: ((variantId: string, quantity: number) => Promise<void>) | undefined
  /** Rendered below the price with the selected variant's price (EMI hint, offers). */
  UnderPrice?: ComponentType<{ pricePaise: number }> | undefined
  /** Rendered under the buy buttons (delivery estimate). */
  belowBuy?: ReactNode
}) {
  // Hooks
  const [pending, startTransition] = useTransition()
  const [added, setAdded] = useState(false)
  const [variantId, setVariantId] = useState(defaultVariant(product)?.id)
  const [slide, setSlide] = useState(() => slideFor(product, defaultVariant(product)))
  const [expanded, setExpanded] = useState(false)

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
                      <img
                        src={img.url}
                        alt={img.alt ?? product.title}
                        width={1200}
                        height={1200}
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
                      <img src={img.url} alt="" width={120} height={120} loading="lazy" />
                    )}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="product-layout__info">
          {product.vendor ? <p className="text-caption">{product.vendor}</p> : null}
          <h1 className="product-info__title h2">{product.title}</h1>
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
                  const unavailable = !target || target.available <= 0
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
            <div className="buy-buttons__row">
              <button
                type="button"
                className={`btn btn--primary buy-buttons__submit${pending ? ' is-loading' : ''}`}
                disabled={!variant || variant.available <= 0 || pending || !onAddToCart}
                onClick={() => {
                  if (!variant || !onAddToCart) return
                  startTransition(async () => {
                    await onAddToCart(variant.id, 1)
                    setAdded(true)
                    setTimeout(() => setAdded(false), 2000)
                  })
                }}
              >
                <span className="btn__label">
                  {!variant || variant.available <= 0
                    ? 'Sold out'
                    : added
                      ? 'Added'
                      : 'Add to cart'}
                </span>
              </button>
              {added ? (
                <a href="/cart" className="btn btn--secondary">
                  View cart
                </a>
              ) : null}
            </div>
            {variant ? (
              <p className="buy-buttons__availability text-small">
                {variant.available > 5
                  ? 'In stock, ships today if ordered before 12 pm'
                  : variant.available > 0
                    ? `Only ${variant.available} left`
                    : 'Notify me when back'}
              </p>
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
