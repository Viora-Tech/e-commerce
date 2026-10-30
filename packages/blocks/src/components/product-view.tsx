'use client'

import { msUntil } from '@commerce/dates'
import { type ComponentType, type ReactNode, useEffect, useState } from 'react'
import { mainProductContent as copy } from '../data/zero-drift/main-product'
import { variantOnPreorder } from '../preorder-state'
import { galleryForVariant, slideForVariant, variantImageUrls } from '../product-gallery-order'
import { announceVariant } from '../product-variant-event'
import {
  hasCopy,
  type MainProductSettings,
  mainProductSettings,
  whatsappHref,
} from '../sections/main-product-settings'
import type { AddToCart } from '../store-actions'
import type { ProductDetail } from '../types'
import Breadcrumbs from './breadcrumbs'
import Price from './price'
import ProductAccordions, { type PolicyPanel } from './product-accordions'
import ProductAssurance from './product-assurance'
import ProductBuyButtons from './product-buy-buttons'
import ProductDescription from './product-description'
import ProductGallery from './product-gallery'
import ProductNoteLine from './product-note-line'
import ProductPaymentSignals, { type UpiDiscount } from './product-payment-signals'
import ProductRating from './product-rating'
import ProductShareRow from './product-share-row'
import ProductSpecGrid from './product-spec-grid'
import ProductStockBar from './product-stock-bar'
import ProductTrustBadges from './product-trust-badges'
import ProductVariantPicker from './product-variant-picker'
import ProductWhatsappAsk from './product-whatsapp-ask'

type ProductViewProps = {
  product: ProductDetail
  /** Shipping and Returns panels from the store's published policies (`showPolicyPanels`). */
  policyPanels?: PolicyPanel[] | undefined
  onAddToCart?: AddToCart | undefined
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
  /** The MainProduct section's settings (`mainProductSettings(saved)`); defaults when omitted. */
  settings?: MainProductSettings | undefined
  /**
   * The store's discount for paying by UPI / bank transfer (its checkout adjustment), so the
   * offer note shows the price checkout will charge; null when it has none, which hides a
   * UPI price note. Left out (the editor canvas), the section's own percentage previews it.
   */
  upiDiscount?: UpiDiscount | null | undefined
}

function defaultVariant(product: ProductDetail) {
  return product.variants.find((v) => v.purchasable) ?? product.variants[0]
}

/** The gallery slide showing a variant's own image, else the first. */
function slideFor(product: ProductDetail, variant: ProductDetail['variants'][number] | undefined) {
  return slideForVariant(galleryForVariant(product.images, variant), variant)
}

// Port of sections/main-product.liquid: the gallery (snippets/product-gallery) beside the buy
// box, whose blocks run in the theme's templates/product.json order, each switched by a
// setting (`../sections/main-product-settings.ts`). Picking a variant fires `variant:changed`
// (`../product-variant-event.ts`) so the sticky add-to-cart bar follows it.
export default function ProductView({
  product,
  onAddToCart,
  UnderPrice,
  belowBuy,
  NotifyMe,
  notifyMeProps,
  settings,
  upiDiscount,
  policyPanels,
}: ProductViewProps) {
  // Hooks
  const [variantId, setVariantId] = useState(defaultVariant(product)?.id)
  const [slide, setSlide] = useState(() => slideFor(product, defaultVariant(product)))
  const [countdown, setCountdown] = useState(() => msUntil(product.launchAt))
  const [pageUrl, setPageUrl] = useState(`/products/${product.handle}`)

  useEffect(() => {
    if (countdown <= 0) return
    // A minute-granularity label doesn't need a per-second tick; it still has to run so
    // the button unlocks at launch.
    const id = setInterval(() => setCountdown(msUntil(product.launchAt)), 30_000)
    return () => clearInterval(id)
  }, [countdown, product.launchAt])

  // Share and WhatsApp links carry the absolute URL, known only in the browser.
  useEffect(() => {
    setPageUrl(`${window.location.origin}/products/${product.handle}`)
  }, [product.handle])

  // Event handlers
  const handlePick = (id: string) => {
    setVariantId(id)
    const v = product.variants.find((x) => x.id === id)
    // A variant with its own images shows them first; one without keeps the slide on show.
    if (variantImageUrls(v).length > 0) setSlide(slideFor(product, v))
    announceVariant({ productId: product.id, variantId: id })
  }

  // Render logic
  const s = settings ?? mainProductSettings()
  const variant = product.variants.find((v) => v.id === variantId) ?? defaultVariant(product)
  const launching = countdown > 0
  const isPreorder = variantOnPreorder(product, variant)
  // A pre-order, a drop not out yet or a sold-out variant cannot be dispatched, so the
  // blocks promising dispatch stand down around it (the theme's pdp_no_dispatch).
  const noDispatch = isPreorder || launching || !variant?.purchasable
  const wa = whatsappHref(s.whatsappNumber, s.whatsappMessage, product.title, pageUrl)
  const stockBar = s.showStockBar && !launching && Boolean(variant)
  const images = galleryForVariant(product.images, variant)

  return (
    <section className="section-product page-width">
      <Breadcrumbs
        items={[
          ...(product.collection
            ? [{ label: product.collection.title, href: product.collection.url }]
            : product.productType
              ? [{ label: product.productType }]
              : []),
          { label: product.title },
        ]}
      />
      <div
        className={`product-layout${s.galleryLayout === 'stacked' ? ' product-layout--stacked' : ''}`}
      >
        <div className="product-layout__gallery">
          <ProductGallery
            images={images}
            title={product.title}
            slide={slide}
            onSelect={setSlide}
            layout={s.galleryLayout}
            lensZoom={s.lensZoom}
          />
        </div>

        <div className="product-layout__info">
          {s.showVendor && product.vendor ? (
            <p className="product-info__vendor">{product.vendor}</p>
          ) : null}
          <h1 className="product-info__title">
            {product.title}
            {isPreorder ? (
              <span className="product-info__preorder-badge">{copy.ui.preorderBadge}</span>
            ) : null}
          </h1>
          {s.showRating ? <ProductRating value={s.ratingValue} count={s.ratingCount} /> : null}
          {variant ? (
            <div className="product-info__price product-info__price--large">
              <Price
                pricePaise={variant.pricePaise}
                mrpPaise={variant.mrpPaise}
                variantId={variant.id}
                percentBadge
              />
              <p className="product-info__tax-note">{copy.ui.inclusiveOfTaxes}</p>
              {UnderPrice && variant.pricePaise != null ? (
                <UnderPrice pricePaise={variant.pricePaise} />
              ) : null}
            </div>
          ) : null}
          {s.showPaymentSignals &&
          !launching &&
          variant?.pricePaise != null &&
          hasCopy(s.paymentNote) ? (
            <ProductPaymentSignals
              note={s.paymentNote}
              pricePaise={variant.pricePaise}
              upiPercent={s.upiPercent}
              heading={s.offerHeading}
              body={s.offerBody}
              supportLabel={s.offerSupportLabel}
              supportUrl={s.offerSupportUrl}
              upiDiscount={upiDiscount}
            />
          ) : null}
          <ProductVariantPicker product={product} variant={variant} onPick={handlePick} />
          {stockBar && variant ? (
            <ProductStockBar
              available={variant.available}
              purchasable={variant.purchasable}
              threshold={s.stockThreshold}
              preorder={isPreorder}
            />
          ) : null}
          <ProductBuyButtons
            product={product}
            variant={variant}
            countdown={countdown}
            isPreorder={isPreorder}
            onAddToCart={onAddToCart}
            NotifyMe={NotifyMe}
            notifyMeProps={notifyMeProps}
            stockBarShown={stockBar}
            preorderLink={s.showPreorderLink ? s.preorderLinkUrl : null}
          />
          {noDispatch ? null : (
            <>
              <ProductNoteLine icon="delivery" text={s.deliveryText} />
              {belowBuy}
            </>
          )}
          {s.showSpecs ? <ProductSpecGrid fields={product.fields} spec={s.specFields} /> : null}
          {s.showTrustBadges ? (
            <ProductTrustBadges
              badges={s.trustBadges}
              noDispatch={noDispatch}
              whatsappHref={wa}
              whatsappLabel={s.trustWhatsappLabel}
            />
          ) : null}
          {s.showAssurance ? (
            <ProductAssurance
              returns={isPreorder ? s.assuranceReturnsPreorder : s.assuranceReturns}
              cod={s.assuranceCod}
              whatsappHref={wa}
              whatsappLabel={s.assuranceWhatsappLabel}
            />
          ) : null}
          {s.showAccordions || (s.showPolicyPanels && policyPanels?.length) ? (
            <ProductAccordions
              items={s.showAccordions ? s.accordions : []}
              fields={product.fields}
              specTableRows={s.specRows}
              policyPanels={s.showPolicyPanels ? policyPanels : undefined}
            />
          ) : null}
          {s.showReturnsLine ? (
            <ProductNoteLine
              icon="shield"
              className="returns-line"
              text={isPreorder ? s.assuranceReturnsPreorder : s.assuranceReturns}
            />
          ) : null}
          {s.showWhatsappAsk ? <ProductWhatsappAsk href={wa} label={s.whatsappAskLabel} /> : null}
          {s.showShare ? (
            <ProductShareRow label={s.shareLabel} title={product.title} url={pageUrl} />
          ) : null}
          {s.showDescription ? <ProductDescription description={product.description} /> : null}
        </div>
      </div>
    </section>
  )
}
