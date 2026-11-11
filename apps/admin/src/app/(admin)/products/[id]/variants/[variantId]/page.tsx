import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import VariantPage from '@/components/products/variant-page/variant-page'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'
import { orNoStoreOrMissing } from '@/lib/store-guard'

/** One read of the product per server render: the tab title and the page share it. */
const loadProduct = cache(async (id: string) =>
  call(appRouter.products.get, { id }, { context: await serverContext() }),
)

type Params = { params: Promise<{ id: string; variantId: string }> }

/** "60% / Black · Wooting 60HE" in the browser tab. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id, variantId } = await params
  const product = await loadProduct(id).catch(() => null)
  const variant = product?.variants.find((v) => v.id === variantId)
  if (!product || !variant) return { title: 'Variant' }
  const name = variant.optionValues.join(' / ') || product.title
  return { title: `${name} · ${product.title}` }
}

/** A variant's own page (Shopify-style): every field it carries and its metafields. */
export default async function VariantEditPage({ params }: Params) {
  const { id, variantId } = await params
  // A malformed id is "Page not found", not a crash.
  const product = await loadProduct(id).catch(orNoStoreOrMissing(undefined))
  if (product === undefined) redirect(routes.selectStore())
  if (!product?.variants.some((v) => v.id === variantId)) notFound()
  // Keyed by the variant: switching to another one starts from its own saved values.
  return <VariantPage key={variantId} product={product} variantId={variantId} />
}
