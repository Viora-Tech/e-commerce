import { ProductView } from '@commerce/blocks'
import { notFound } from 'next/navigation'
import DeliveryEstimateWidget from '@/components/product/delivery-estimate'
import EmiHint from '@/components/product/emi-hint'
import RecentlyViewed from '@/components/product/recently-viewed'
import RecordView from '@/components/product/record-view'
import RelatedProducts from '@/components/product/related-products'
import { addLineAction } from '@/lib/cart-actions'
import { getProductByHandle } from '@/lib/catalog'
import { storeOffersEmi } from '@/lib/payments'
import { inStore } from '@/lib/store-context'
import { renderTemplate } from '@/lib/template-render'

type Params = {
  params: Promise<{ storeId: string; handle: string }>
  searchParams: Promise<{ view?: string }>
}

const limitOf = (value: unknown) => (typeof value === 'number' ? value : 4)
const headingOf = (value: unknown) => (typeof value === 'string' ? value : '')

export default async function ProductPage({ params, searchParams }: Params) {
  const { storeId, handle } = await params
  const { view } = await searchParams
  const { product, emi } = await inStore(storeId, async (tx) => ({
    product: await getProductByHandle(tx, handle),
    emi: await storeOffersEmi(tx, storeId),
  }))

  if (!product) notFound()
  const add = addLineAction.bind(null, storeId)
  return inStore(storeId, (tx) =>
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
}
