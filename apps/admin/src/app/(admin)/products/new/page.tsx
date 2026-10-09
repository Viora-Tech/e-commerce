import { redirect } from 'next/navigation'
import ProductForm from '@/components/products/product-form'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'
import { orNoStore } from '@/lib/store-guard'
import { storefrontOrigin } from '@/lib/storefront-origin'

export default async function NewProductPage() {
  const context = await serverContext()
  const [facets, ai] = await Promise.all([
    call(appRouter.products.facets, undefined, { context }).catch(orNoStore(null)),
    // AI is optional: any failure just hides the button.
    call(appRouter.ai.status, undefined, { context }).catch(() => null),
  ])
  if (!facets) redirect(routes.selectStore())
  return (
    <ProductForm
      product={null}
      facets={facets}
      storefrontOrigin={await storefrontOrigin()}
      aiWriter={ai?.productWriter ?? false}
    />
  )
}
