import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import ProductForm from '@/components/products/product-form'
import { appRouter, call, serverContext } from '@/lib/api'
import { PRODUCT_LAYOUT_COOKIE, parseProductLayout } from '@/lib/product-layout'
import { routes } from '@/lib/routes'
import { listApps } from '@/lib/shell-data'
import { orNoStoreOrMissing } from '@/lib/store-guard'
import { storefrontOrigin } from '@/lib/storefront-origin'

/**
 * One read per server render, in one call and one transaction: the product, the store's
 * suggestions, the "Write with AI" switch and the shipping boxes (`products.getPage`). The tab
 * title and the page share it.
 */
const loadPage = cache(async (id: string) =>
  call(appRouter.products.getPage, { id }, { context: await serverContext() }),
)

type Params = { params: Promise<{ id: string }> }

/** The product's name in the browser tab, not "Admin". */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const page = await loadPage(id).catch(() => null)
  return { title: page?.product?.title || 'Product' }
}

export default async function ProductEditPage({ params }: Params) {
  const { id } = await params
  // Installed apps add sections and More actions; without settings access the list is empty.
  const installed = listApps().catch(() => [])
  // A malformed id (/products/pre-orders) is "Page not found", not a crash.
  const page = await loadPage(id).catch(orNoStoreOrMissing(undefined))
  if (page === undefined) redirect(routes.selectStore())
  if (!page?.product) notFound()
  const [apps, origin, cookieJar] = await Promise.all([installed, storefrontOrigin(), cookies()])
  return (
    <ProductForm
      product={page.product}
      facets={page.facets}
      boxPresets={page.boxPresets}
      storefrontOrigin={origin}
      aiWriter={page.aiWriter}
      layout={parseProductLayout(cookieJar.get(PRODUCT_LAYOUT_COOKIE)?.value)}
      apps={apps
        .filter((a) => a.installed)
        .map((a) => ({ id: a.id, name: a.name, icon: a.admin.icon }))}
    />
  )
}
