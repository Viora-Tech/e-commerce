import {
  mainProductSettings,
  ProductView,
  ReviewsWidget,
  variantOnPreorder,
} from '@commerce/blocks'
import { mainProductRichtext, productFieldsRichtext } from '@commerce/blocks/richtext-node'
import { loadProductPageExtras } from '@commerce/core'
import { seoProse, seoSnippet } from '@commerce/core/catalog'
import { isAbroad } from '@commerce/core/checkout-address'
import { productOfferPolicies } from '@commerce/core/offer-policies'
import {
  depositIsNonRefundable,
  type PreorderStoreSettings,
  parsePreorderStoreSettings,
} from '@commerce/core/preorder'
import { numericId } from '@commerce/core/theme-import'
import { store } from '@commerce/db'
import { formatMoney, isCurrency } from '@commerce/money'
import { emiOfferFor } from '@commerce/plugin-emi/offer'
import { parseRichText, richTextToPlainText } from '@commerce/richtext'
import { eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import PixelTrack from '@/components/analytics/pixel-track'
import DeliveryEstimateWidget from '@/components/product/delivery-estimate'
import EmiHint from '@/components/product/emi-hint'
import EmiOffers from '@/components/product/emi-offers'
import EmiOffersProvider from '@/components/product/emi-offers-provider'
import NotifyMeForm from '@/components/product/notify-me-form'
import RecentlyViewed from '@/components/product/recently-viewed'
import RecordView from '@/components/product/record-view'
import RelatedProducts from '@/components/product/related-products'
import JsonLd from '@/components/seo/json-ld'
import LiquidAppBlock from '@/components/theme/liquid-app-block'
import LiquidPreorderNote from '@/components/theme/liquid-preorder-note'
import { notifyMeAction } from '@/lib/back-in-stock-actions'
import { backInStockContext } from '@/lib/back-in-stock-context'
import { addLineAction } from '@/lib/cart-actions'
import { getProductByHandle, getProductSeo, type ProductDetail } from '@/lib/catalog'
import { storeEmiOffers } from '@/lib/emi-offers'
import { MARKET_HEADERS } from '@/lib/markets'
import { storeOffersEmi, storeUpiDiscount } from '@/lib/payments'
import { productForView } from '@/lib/product-view-props'
import { policyPanels } from '@/lib/related'
import { productReviews } from '@/lib/reviews'
import {
  marketCanonical,
  metaDescription,
  paiseToAmount,
  productDescription,
  productGraph,
  requestOrigin,
} from '@/lib/seo'
import { shareImageUrl } from '@/lib/share-image'
import { estimateDeliveryAction } from '@/lib/shipping-actions'
import { storeRead } from '@/lib/store-cache'
import { renderTemplate } from '@/lib/template-render'

/** Same rule ProductView uses for its initial pick: the first purchasable variant. */
function defaultVariant(product: ProductDetail) {
  return product.variants.find((v) => v.purchasable) ?? product.variants[0]
}

type Params = {
  params: Promise<{ storeId: string; handle: string }>
  searchParams: Promise<{ view?: string; review?: string; write?: string }>
}

/**
 * The pre-order note per variant that sells on pre-order, for an imported theme's buy button
 * (#936), keyed by the numeric id its Liquid writes and by the UUID.
 */
function liquidPreorderNotes(product: ProductDetail): Record<string, string> {
  const note = product.preorder?.note
  if (!note) return {}
  return Object.fromEntries(
    product.variants
      .filter((v) => variantOnPreorder(product, v))
      .flatMap((v) => [
        [String(numericId(v.id)), note],
        [v.id, note],
      ]),
  )
}

const limitOf = (value: unknown) => (typeof value === 'number' ? value : 4)
const headingOf = (value: unknown) => (typeof value === 'string' ? value : '')

/** A deposit the store keeps when the balance goes unpaid is said so next to "Pay X now". */
function withDepositPolicy(product: ProductDetail, policy: PreorderStoreSettings): ProductDetail {
  if (!product.preorder?.depositPreview || !depositIsNonRefundable(policy)) return product
  return {
    ...product,
    preorder: { ...product.preorder, nonRefundableDepositDays: policy.payWithinDays },
  }
}

/** One load per store version (and per request), shared by the metadata and the page. */
const loadProduct = cache((storeId: string, handle: string) =>
  storeRead(storeId, `product-page|${handle}`, async (tx) => {
    const [s] = await tx
      .select({ name: store.name, currency: store.currency, preorder: store.preorder })
      .from(store)
      .where(eq(store.id, storeId))
    const policy = parsePreorderStoreSettings(s?.preorder)
    const found = await getProductByHandle(tx, handle, policy.note)
    if (!found) return null
    const seo = await getProductSeo(tx, found.id)
    const product = withDepositPolicy(found, policy)
    const text = richTextToPlainText(parseRichText(product.description))
    const storeName = s?.name ?? ''
    const currency = s?.currency ?? 'INR'
    const pricePaise = defaultVariant(product)?.pricePaise
    return {
      product,
      title: seo?.seoTitle || product.title,
      description: productDescription({
        seoDescription: seo?.seoDescription,
        prose: seoProse(text),
        title: product.title,
        vendor: product.vendor,
        storeName,
        price:
          pricePaise != null && isCurrency(currency) ? formatMoney(pricePaise, currency) : null,
      }),
      // The structured data keeps the body's own words, spec rows and all.
      ldDescription: metaDescription(seo?.seoDescription || seoSnippet(text)),
      storeName,
      currency,
    }
  }),
)

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { storeId, handle } = await params
  const found = await loadProduct(storeId, handle)
  if (!found) return {}
  const { product, title, description } = found
  const url = await marketCanonical(`/products/${product.handle}`)
  const first = defaultVariant(product)
  const price = first?.pricePaise
  const images = product.images
    .filter((i) => !i.contentType?.startsWith('video/'))
    .slice(0, 4)
    .map((i) => ({ url: shareImageUrl(i), alt: i.alt || product.title }))
  return {
    title,
    description,
    // The Markdown copy for AI agents (`/products/<handle>.md`, `lib/shopify-json/paths.ts`).
    alternates: { canonical: url, types: { 'text/markdown': `${url}.md` } },
    openGraph: { type: 'website', url, title, description, images },
    twitter: { card: images.length ? 'summary_large_image' : 'summary', title, description },
    // Shopify's product price tags, which link previews, price sites and AI agents read; the
    // `og:` twins for readers that only know those.
    ...(price != null
      ? {
          other: {
            'product:price:amount': paiseToAmount(price),
            'product:price:currency': found.currency,
            'og:price:amount': paiseToAmount(price),
            'og:price:currency': found.currency,
            'product:availability': first?.purchasable ? 'in stock' : 'out of stock',
          },
        }
      : {}),
  }
}

export default async function ProductPage({ params, searchParams }: Params) {
  const { storeId, handle } = await params
  const { view, review, write } = await searchParams
  const found = await loadProduct(storeId, handle)
  if (!found) notFound()
  const { product } = found
  // None of these reads needs another's result and each opens its own short transaction (only on
  // a cache miss), so they run together.
  const [reviews, extras, upiDiscount, emiApp, bis, policies, offerPolicies] = await Promise.all([
    // Reviews app: the widget's data, and the real rating for the stars under the title.
    productReviews(storeId, product, {
      requestToken: typeof review === 'string' ? review : null,
      // A review QR card's link (`?write=1`) opens the form straight away.
      openForm: write === '1',
      storeName: found.storeName,
    }),
    storeRead(storeId, `product-extras|${product.id}`, (tx) =>
      loadProductPageExtras(tx, product.id, product.vendor),
    ),
    storeRead(storeId, 'upi-discount', (tx) => storeUpiDiscount(tx, storeId)),
    storeRead(storeId, 'emi-offers', (tx) => storeEmiOffers(tx, storeId)),
    storeRead(storeId, 'back-in-stock', (tx) => backInStockContext(tx, storeId)),
    storeRead(storeId, 'policy-panels', (tx) => policyPanels(tx)),
    // Returns and India shipping for the structured data's merchant-listing fields.
    storeRead(storeId, 'offer-policies', (tx) => productOfferPolicies(tx, storeId)),
  ])
  // The stars are the product's real figure: the Reviews app's, else the rating imported
  // from Shopify's review app; never a typed one.
  const rated =
    reviews && reviews.summary.count > 0
      ? reviews.summary
      : extras.rating
        ? { rating: extras.rating.value, count: extras.rating.count }
        : null
  const shown = {
    ...product,
    fields: productFieldsRichtext(extras.fields),
    collection: extras.collection,
  }
  // Before the EMI & pay later app is installed, the older built-in hint still shows.
  const legacyEmi = emiApp.installed
    ? false
    : await storeRead(storeId, 'legacy-emi', (tx) => storeOffersEmi(tx, storeId))
  // EMI and UPI are Indian ways to pay: a shopper in a market abroad sees neither the
  // "EMI from ₹…" line nor a "… with UPI" price (the cart says the same, `paymentsAbroad`).
  const abroad = isAbroad((await headers()).get(MARKET_HEADERS.country) ?? 'IN')
  const UnderPrice = abroad
    ? undefined
    : emiApp.config
      ? EmiOffers
      : legacyEmi
        ? EmiHint
        : undefined
  const variant = defaultVariant(product)
  const isPreorder = variantOnPreorder(product, variant)
  const schema = productGraph(
    {
      ...product,
      description: found.ldDescription ?? found.description,
      collection: extras.collection,
      images: product.images.filter((i) => !i.contentType?.startsWith('video/')),
      rating: rated ? { value: rated.rating, count: rated.count } : null,
      reviews:
        reviews?.widget.reviews.slice(0, 5).map((r) => ({
          author: r.name,
          rating: r.rating,
          title: r.title,
          body: r.body,
        })) ?? [],
      policies: offerPolicies,
    },
    await requestOrigin(),
    found.currency,
    found.storeName,
  )
  const page = await renderTemplate(storeId, 'product', {
    suffix: product.templateSuffix,
    sources: { productId: product.id },
    product,
    productActions: { addToCart: addLineAction },
    view,
    appBlockContext: {
      notifyMe:
        bis.installed && variant
          ? {
              variantId: variant.id,
              available: variant.available,
              isPreorder,
              whatsappEnabled: bis.whatsappEnabled,
              buttonText: bis.buttonText,
              action: notifyMeAction,
            }
          : undefined,
      preorderCountdown: {
        enabled: Boolean(product.preorder?.enabled),
        launchAt: product.launchAt ?? null,
      },
      deliveryChecker: { estimate: estimateDeliveryAction },
      emiOffers: abroad ? null : emiOfferFor(emiApp.config, variant?.pricePaise ?? 0),
      reviews: reviews?.widget,
    },
    renderers: {
      MainProduct: (s) => {
        const settings = mainProductSettings(s)
        const view = (
          <ProductView
            // Only what the buy box draws reaches the page's RSC payload.
            product={productForView(shown, settings)}
            onAddToCart={addLineAction}
            settings={{
              // Body copy sanitised here, so the browser never loads the sanitiser.
              ...mainProductRichtext(settings),
              ...(abroad ? { showPaymentSignals: false } : {}),
              ratingValue: rated?.rating ?? 0,
              ratingCount: rated?.count ?? 0,
            }}
            upiDiscount={upiDiscount}
            policyPanels={policies}
            // Drawn as `showEmiHint` / `showDeliveryEstimate` say (off on an imported theme, #1049).
            UnderPrice={UnderPrice}
            belowBuy={<DeliveryEstimateWidget />}
            NotifyMe={bis.installed ? NotifyMeForm : undefined}
            notifyMeProps={
              bis.installed
                ? { whatsappEnabled: bis.whatsappEnabled, buttonText: bis.buttonText }
                : undefined
            }
          />
        )
        return (
          <>
            {emiApp.config ? (
              <EmiOffersProvider config={emiApp.config}>{view}</EmiOffersProvider>
            ) : (
              view
            )}
            <RecordView handle={product.handle} />
          </>
        )
      },
      RelatedProducts: (s) => (
        <RelatedProducts
          storeId={storeId}
          product={product}
          heading={headingOf(s.heading)}
          limit={limitOf(s.limit)}
        />
      ),
      RecentlyViewed: (s) => (
        <RecentlyViewed
          storeId={storeId}
          exclude={product.handle}
          heading={headingOf(s.heading)}
          limit={limitOf(s.limit)}
        />
      ),
    },
  })
  return (
    <>
      <JsonLd data={schema} />
      {/* Pixels app: ViewContent, sent only after a yes to marketing. */}
      <PixelTrack
        event={{
          name: 'ViewContent',
          productId: product.id,
          variantId: variant?.id,
          valuePaise: variant?.pricePaise ?? undefined,
        }}
      />
      {page}
      {/* An imported theme's Judge.me review widget (an app block) draws our Reviews app here. */}
      {/* An imported theme's buy button gets the pre-order note its Shopify app printed. */}
      {product.preorder?.note ? <LiquidPreorderNote notes={liquidPreorderNotes(product)} /> : null}
      {reviews ? (
        <LiquidAppBlock slot="reviews">
          <ReviewsWidget context={reviews.widget} />
        </LiquidAppBlock>
      ) : null}
    </>
  )
}
