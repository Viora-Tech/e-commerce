import { ProductView } from '@commerce/blocks'
import { notFound } from 'next/navigation'
import { getProductByHandle } from '@/lib/catalog'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string; handle: string }> }

export default async function ProductPage({ params }: Params) {
  const { storeId, handle } = await params
  const product = await inStore(storeId, (tx) => getProductByHandle(tx, handle))
  if (!product) notFound()
  return <ProductView product={product} />
}
