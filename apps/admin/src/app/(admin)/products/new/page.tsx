import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ProductForm from '@/components/products/product-form'
import { productFormContent } from '@/data/product-form'
import { appRouter, call, serverContext } from '@/lib/api'
import { PRODUCT_LAYOUT_COOKIE, parseProductLayout } from '@/lib/product-layout'
import { routes } from '@/lib/routes'
import { listApps } from '@/lib/shell-data'
import { orNoStore } from '@/lib/store-guard'
import { storefrontOrigin } from '@/lib/storefront-origin'

/** "Add new product" in the browser tab, not "Admin". */
export const metadata: Metadata = { title: productFormContent.newTitle }

export default async function NewProductPage() {
  const context = await serverContext()
  const [page, installed, origin, cookieJar] = await Promise.all([
    // The store's suggestions, "Write with AI" and the shipping boxes in one call.
    call(appRouter.products.getPage, {}, { context }).catch(orNoStore(null)),
    // Installed apps' sections wait for the first save; without settings access the list is empty.
    listApps().catch(() => []),
    storefrontOrigin(),
    cookies(),
  ])
  if (!page) redirect(routes.selectStore())
  return (
    <ProductForm
      product={null}
      facets={page.facets}
      boxPresets={page.boxPresets}
      storefrontOrigin={origin}
      aiWriter={page.aiWriter}
      layout={parseProductLayout(cookieJar.get(PRODUCT_LAYOUT_COOKIE)?.value)}
      apps={installed
        .filter((a) => a.installed)
        .map((a) => ({ id: a.id, name: a.name, icon: a.admin.icon }))}
    />
  )
}
