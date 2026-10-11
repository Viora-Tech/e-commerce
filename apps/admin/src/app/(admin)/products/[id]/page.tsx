import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import ProductForm from '@/components/products/product-form'
import { appRouter, call, serverContext } from '@/lib/api'
import { PRODUCT_LAYOUT_COOKIE, parseProductLayout } from '@/lib/product-layout'
import { routes } from '@/lib/routes'
import { orNoStore } from '@/lib/store-guard'
import { storefrontOrigin } from '@/lib/storefront-origin'

type Params = { params: Promise<{ id: string }> }

export default async function ProductEditPage({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  const [product, facets, ai] = await Promise.all([
    call(appRouter.products.get, { id }, { context }),
    call(appRouter.products.facets, undefined, { context }),
    // AI is optional: any failure just hides the button.
    call(appRouter.ai.status, undefined, { context }).catch(() => null),
  ]).catch(orNoStore([undefined, undefined, null] as const))
  if (product === undefined || !facets) redirect(routes.selectStore())
  if (!product) notFound()
  return (
    <ProductForm
      product={product}
      facets={facets}
      storefrontOrigin={await storefrontOrigin()}
      aiWriter={ai?.productWriter ?? false}
      layout={parseProductLayout((await cookies()).get(PRODUCT_LAYOUT_COOKIE)?.value)}
    />
  )
}
