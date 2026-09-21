import { loadEnv } from '@commerce/config'
import { redirect } from 'next/navigation'
import { ProductForm } from '@/components/products/product-form'
import { appRouter, call, serverContext } from '@/lib/api'

export default async function NewProductPage() {
  const context = await serverContext()
  const facets = await call(appRouter.products.facets, undefined, { context }).catch(() => null)
  if (!facets) redirect('/select-store')
  return (
    <ProductForm
      product={null}
      facets={facets}
      storefrontOrigin={loadEnv(process.env).STOREFRONT_URL}
    />
  )
}
