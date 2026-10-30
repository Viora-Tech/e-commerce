import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import ProductForm from '@/components/products/product-form'
import { appRouter, call, serverContext } from '@/lib/api'
import { PRODUCT_LAYOUT_COOKIE, parseProductLayout } from '@/lib/product-layout'
import { routes } from '@/lib/routes'
import { listApps } from '@/lib/shell-data'
import { orNoStore } from '@/lib/store-guard'
import { storefrontOrigin } from '@/lib/storefront-origin'

type Params = { params: Promise<{ id: string }> }

/** The product's name in the browser tab, not "Admin". */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const context = await serverContext()
  const product = await call(appRouter.products.get, { id }, { context }).catch(() => null)
  return { title: product?.title || 'Product' }
}

export default async function ProductEditPage({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  // Installed apps add sections and More actions; without settings access the list is empty.
  const installed = listApps().catch(() => [])
  const [product, facets, ai] = await Promise.all([
    call(appRouter.products.get, { id }, { context }),
    call(appRouter.products.facets, undefined, { context }),
    // AI is optional: any failure just hides the button.
    call(appRouter.ai.status, undefined, { context }).catch(() => null),
  ]).catch(orNoStore([undefined, undefined, null] as const))
  if (product === undefined || !facets) redirect(routes.selectStore())
  if (!product) notFound()
  const apps = (await installed)
    .filter((a) => a.installed)
    .map((a) => ({ id: a.id, name: a.name, icon: a.admin.icon }))
  return (
    <ProductForm
      product={product}
      facets={facets}
      storefrontOrigin={await storefrontOrigin()}
      aiWriter={ai?.productWriter ?? false}
      layout={parseProductLayout((await cookies()).get(PRODUCT_LAYOUT_COOKIE)?.value)}
      apps={apps}
    />
  )
}
