import { ProductView } from '@commerce/blocks'
import { store } from '@commerce/db'
import { parseRichText, richTextToPlainText } from '@commerce/richtext'
import { eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import DeliveryEstimateWidget from '@/components/product/delivery-estimate'
import EmiHint from '@/components/product/emi-hint'
import RecentlyViewed from '@/components/product/recently-viewed'
import RecordView from '@/components/product/record-view'
import RelatedProducts from '@/components/product/related-products'
import { addLineAction } from '@/lib/cart-actions'
import { getProductByHandle, getProductSeo } from '@/lib/catalog'
import { storeOffersEmi } from '@/lib/payments'
import { jsonLd, metaDescription, productGraph, requestOrigin } from '@/lib/seo'
import { inStore } from '@/lib/store-context'
import { renderTemplate } from '@/lib/template-render'

type Params = {
  params: Promise<{ storeId: string; handle: string }>
  searchParams: Promise<{ view?: string }>
}

const limitOf = (value: unknown) => (typeof value === 'number' ? value : 4)
const headingOf = (value: unknown) => (typeof value === 'string' ? value : '')

/** One load per request, shared by the metadata and the page. */
const loadProduct = cache((storeId: string, handle: string) =>
  inStore(storeId, async (tx) => {
    const product = await getProductByHandle(tx, handle)
    if (!product) return null
    const [seo, [s]] = await Promise.all([
      getProductSeo(tx, product.id),
      tx
        .select({ name: store.name, currency: store.currency })
        .from(store)
        .where(eq(store.id, storeId)),
    ])
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
  const { view } = await searchParams
  const found = await loadProduct(storeId, handle)
  if (!found) notFound()
  const { product } = found
  const emi = await inStore(storeId, (tx) => storeOffersEmi(tx, storeId))
  const add = addLineAction.bind(null, storeId)
  const schema = productGraph(
    {
      ...product,
      description: found.description,
      images: product.images.filter((i) => !i.contentType?.startsWith('video/')),
    },
    await requestOrigin(),
    found.currency,
    found.storeName,
  )
  const page = await inStore(storeId, (tx) =>
    renderTemplate(tx, storeId, 'product', {
      suffix: product.templateSuffix,
      view,
      renderers: {
        MainProduct: (s) => (
          <>
            <ProductView
              product={product}
              onAddToCart={add}
              UnderPrice={emi && s.showEmiHint !== false ? EmiHint : undefined}
              belowBuy={
                s.showDeliveryEstimate === false ? undefined : (
                  <DeliveryEstimateWidget storeId={storeId} />
                )
              }
            />
            <RecordView handle={product.handle} />
          </>
        ),
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
    }),
  )
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from our own data; jsonLd() escapes it. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(schema)} />
      {page}
    </>
  )
}
