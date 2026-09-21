import { loadEnv } from '@commerce/config'
import { notFound, redirect } from 'next/navigation'
import { ProductForm } from '@/components/products/product-form'
import { appRouter, call, serverContext } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

export default async function ProductEditPage({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  const [product, facets] = await Promise.all([
    call(appRouter.products.get, { id }, { context }),
    call(appRouter.products.facets, undefined, { context }),
  ]).catch(() => [undefined, undefined] as const)
  if (product === undefined || !facets) redirect('/select-store')
  if (!product) notFound()
  return (
    <ProductForm
      product={product}
      facets={facets}
      storefrontOrigin={loadEnv(process.env).STOREFRONT_URL}
    />
  )
}
