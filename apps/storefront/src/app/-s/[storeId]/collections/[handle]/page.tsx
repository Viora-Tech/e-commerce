import { parseRichText, richTextToPlainText } from '@commerce/richtext'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MainCollection from '@/components/collections/main-collection'
import { COLLECTION_PER_PAGE, SORT_OPTIONS } from '@/data/collections'
import { getCollectionByHandle, listCollectionProducts } from '@/lib/collections'
import { canonicalPath, metaDescription, requestOrigin } from '@/lib/seo'
import { inStore } from '@/lib/store-context'
import { renderTemplate } from '@/lib/template-render'

type Params = {
  params: Promise<{ storeId: string; handle: string }>
  searchParams: Promise<{ sort?: string; page?: string; view?: string }>
}

function parseSort(value: string | undefined, fallback: string): string {
  return SORT_OPTIONS.some((o) => o.value === value) ? (value as string) : fallback
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { storeId, handle } = await params
  const { page } = await searchParams
  const found = await inStore(storeId, (tx) => getCollectionByHandle(tx, handle))
  if (!found) return {}
  const title = found.seoTitle || found.title
  const description = metaDescription(
    found.seoDescription || richTextToPlainText(parseRichText(found.description)),
  )
  const url = canonicalPath(`/collections/${found.handle}`, Number.parseInt(page ?? '1', 10) || 1)
  const image = found.imageUrl ? [{ url: found.imageUrl, alt: found.title }] : undefined
  return {
    title,
    description,
    // A sort is the same products reordered, so it points at the unsorted page.
    alternates: { canonical: url },
    openGraph: { type: 'website', url, title, description, images: image },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description },
  }
}

export default async function CollectionPage({ params, searchParams }: Params) {
  const { storeId, handle } = await params
  const query = await searchParams
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1)

  const data = await inStore(storeId, async (tx) => {
    const found = await getCollectionByHandle(tx, handle)
    if (!found) return null
    const sort = parseSort(query.sort, found.sortOrder)
    const products = await listCollectionProducts(tx, found.id, {
      sort: sort as typeof found.sortOrder,
      page,
      perPage: COLLECTION_PER_PAGE,
    })
    return { collection: found, products, sort }
  })

  if (!data) notFound()
  const { collection, products, sort } = data
  const origin = await requestOrigin()
  return inStore(storeId, (tx) =>
    renderTemplate(tx, storeId, 'collection', {
      suffix: collection.templateSuffix,
      view: query.view,
      renderers: {
        MainCollection: (settings) => (
          <MainCollection
            handle={handle}
            origin={origin}
            collection={collection}
            products={products}
            sort={sort}
            page={page}
            settings={settings}
          />
        ),
      },
    }),
  )
}
