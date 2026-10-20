import { mainProductSettings, ProductView, ReviewsWidget } from '@commerce/blocks'
import { loadProductPageExtras } from '@commerce/core'
import {
  depositIsNonRefundable,
  type PreorderStoreSettings,
  parsePreorderStoreSettings,
} from '@commerce/core/preorder'
import { store } from '@commerce/db'
import { emiOfferFor } from '@commerce/plugin-emi/offer'
import { parseRichText, richTextToPlainText } from '@commerce/richtext'
import { eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import DeliveryEstimateWidget from '@/components/product/delivery-estimate'
import EmiHint from '@/components/product/emi-hint'
import EmiOffers from '@/components/product/emi-offers'
import EmiOffersProvider from '@/components/product/emi-offers-provider'
import NotifyMeForm from '@/components/product/notify-me-form'
import RecentlyViewed from '@/components/product/recently-viewed'
import RecordView from '@/components/product/record-view'
import RelatedProducts from '@/components/product/related-products'
import LiquidAppBlock from '@/components/theme/liquid-app-block'
import { notifyMeAction } from '@/lib/back-in-stock-actions'
import { backInStockContext } from '@/lib/back-in-stock-context'
import { addLineAction } from '@/lib/cart-actions'
import { getProductByHandle, getProductSeo, type ProductDetail } from '@/lib/catalog'
import { storeEmiOffers } from '@/lib/emi-offers'
import { storeOffersEmi, storeUpiDiscount } from '@/lib/payments'
import { productReviews } from '@/lib/reviews'
import { jsonLd, metaDescription, productGraph, requestOrigin } from '@/lib/seo'
import { estimateDeliveryAction } from '@/lib/shipping-actions'
import { storeRead } from '@/lib/store-cache'
import { renderTemplate } from '@/lib/template-render'

/** Same rule ProductView uses for its initial pick: the first purchasable variant. */
function defaultVariant(product: ProductDetail) {
  return product.variants.find((v) => v.purchasable) ?? product.variants[0]
}

type Params = {
  params: Promise<{ storeId: string; handle: string }>
  searchParams: Promise<{ view?: string; review?: string }>
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
    const found = await getProductByHandle(tx, handle)
    if (!found) return null
    const [seo, [s]] = await Promise.all([
      getProductSeo(tx, found.id),
      tx
        .select({ name: store.name, currency: store.currency, preorder: store.preorder })
        .from(store)
        .where(eq(store.id, storeId)),
    ])
    const product = withDepositPolicy(found, parsePreorderStoreSettings(s?.preorder))
    const text = richTextToPlainText(parseRichText(product.description))
    return {
      product,
      title: seo?.seoTitle || product.title,
      description: metaDescription(seo?.seoDescription || text),
      storeName: s?.name ?? '',
      currency: s?.currency ?? 'INR',
    }
  }),
)

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { storeId, handle } = await params
  const found = await loadProduct(storeId, handle)
  if (!found) return {}
  const { product, title, description } = found
  const url = `/products/${product.handle}`
  const images = product.images
    .filter((i) => !i.contentType?.startsWith('video/'))
    .slice(0, 4)
    .map((i) => ({ url: i.url, alt: i.alt ?? product.title }))
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, title, description, images },
    twitter: { card: images.length ? 'summary_large_image' : 'summary', title, description },
  }
}

export default async function ProductPage({ params, searchParams }: Params) {
  const { storeId, handle } = await params
  const { view, review } = await searchParams
  const found = await loadProduct(storeId, handle)
  if (!found) notFound()
  const { product } = found
  // Reviews app: the widget's data, and the real rating for the stars under the title.
  const reviews = await productReviews(storeId, product, {
    requestToken: typeof review === 'string' ? review : null,
    storeName: found.storeName,
  })
  const extras = await storeRead(storeId, `product-extras|${product.id}`, (tx) =>
    loadProductPageExtras(tx, product.id),
  )
  // The stars are the product's real figure: the Reviews app's, else the rating imported
  // from Shopify's review app; never a typed one.
  const rated =
    reviews && reviews.summary.count > 0
      ? reviews.summary
      : extras.rating
        ? { rating: extras.rating.value, count: extras.rating.count }
        : null
  const upiDiscount = await storeRead(storeId, 'upi-discount', (tx) =>
    storeUpiDiscount(tx, storeId),
  )
  const shown = { ...product, fields: extras.fields, collection: extras.collection }
  const emiApp = await storeRead(storeId, 'emi-offers', (tx) => storeEmiOffers(tx, storeId))
  // Before the EMI & pay later app is installed, the older built-in hint still shows.
  const legacyEmi = emiApp.installed
    ? false
    : await storeRead(storeId, 'legacy-emi', (tx) => storeOffersEmi(tx, storeId))
  const UnderPrice = emiApp.config ? EmiOffers : legacyEmi ? EmiHint : undefined
  const bis = await storeRead(storeId, 'back-in-stock', (tx) => backInStockContext(tx, storeId))
  const variant = defaultVariant(product)
  const isPreorder = Boolean(product.preorder?.enabled) && (!variant || variant.available <= 0)
  const schema = productGraph(
    {
      ...product,
      description: found.description,
      images: product.images.filter((i) => !i.contentType?.startsWith('video/')),
      rating: rated ? { value: rated.rating, count: rated.count } : null,
      reviews:
        reviews?.widget.reviews.slice(0, 5).map((r) => ({
          author: r.name,
          rating: r.rating,
          title: r.title,
          body: r.body,
        })) ?? [],
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
              action: notifyMeAction,
            }
          : undefined,
      preorderCountdown: {
        enabled: Boolean(product.preorder?.enabled),
        launchAt: product.launchAt ?? null,
      },
      deliveryChecker: { estimate: estimateDeliveryAction },
      emiOffers: emiOfferFor(emiApp.config, variant?.pricePaise ?? 0),
      reviews: reviews?.widget,
    },
    renderers: {
      MainProduct: (s) => {
        const view = (
          <ProductView
            product={shown}
            onAddToCart={addLineAction}
            settings={{
              ...mainProductSettings(s),
              ratingValue: rated?.rating ?? 0,
              ratingCount: rated?.count ?? 0,
            }}
            upiDiscount={upiDiscount}
            UnderPrice={s.showEmiHint !== false ? UnderPrice : undefined}
            belowBuy={s.showDeliveryEstimate === false ? undefined : <DeliveryEstimateWidget />}
            NotifyMe={bis.installed ? NotifyMeForm : undefined}
            notifyMeProps={bis.installed ? { whatsappEnabled: bis.whatsappEnabled } : undefined}
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
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from our own data; jsonLd() escapes it. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(schema)} />
      {page}
      {/* An imported theme's Judge.me review widget (an app block) draws our Reviews app here. */}
      {reviews ? (
        <LiquidAppBlock slot="reviews">
          <ReviewsWidget context={reviews.widget} />
        </LiquidAppBlock>
      ) : null}
    </>
  )
}
