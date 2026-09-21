import { ProductView } from '@commerce/blocks'
import { notFound } from 'next/navigation'
import DeliveryEstimateWidget from '@/components/product/delivery-estimate'
import EmiHint from '@/components/product/emi-hint'
import { addLineAction } from '@/lib/cart-actions'
import { getProductByHandle } from '@/lib/catalog'
import { storeOffersEmi } from '@/lib/payments'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string; handle: string }> }

export default async function ProductPage({ params }: Params) {
  const { storeId, handle } = await params
  const { product, emi } = await inStore(storeId, async (tx) => ({
    product: await getProductByHandle(tx, handle),
    emi: await storeOffersEmi(tx, storeId),
  }))

  if (!product) notFound()
  const add = addLineAction.bind(null, storeId)
  return (
    <ProductView
      product={product}
      onAddToCart={add}
      UnderPrice={emi ? EmiHint : undefined}
      belowBuy={<DeliveryEstimateWidget storeId={storeId} />}
    />
  )
}
