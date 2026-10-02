import { loadEnv } from '@commerce/config'
import { notFound, redirect } from 'next/navigation'
import ProductForm from '@/components/products/product-form'
import { appRouter, call, serverContext } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

export default async function ProductEditPage({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  const [product, facets, ai] = await Promise.all([
    call(appRouter.products.get, { id }, { context }),
    call(appRouter.products.facets, undefined, { context }),
    // AI is optional: any failure just hides the button.
    call(appRouter.ai.status, undefined, { context }).catch(() => null),
  ]).catch(() => [undefined, undefined, null] as const)
  if (product === undefined || !facets) redirect('/select-store')
  if (!product) notFound()
  return (
    <ProductForm
      product={product}
      facets={facets}
      storefrontOrigin={loadEnv(process.env).STOREFRONT_URL}
      aiWriter={ai?.productWriter ?? false}
    />
  )
}
