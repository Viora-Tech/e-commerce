import { parseRichText, RichTextRenderer } from '@commerce/richtext'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import CollectionGrid from '@/components/collections/collection-grid'
import CollectionSort from '@/components/collections/collection-sort'
import { COLLECTION_PER_PAGE, collectionsContent as copy, SORT_OPTIONS } from '@/data/collections'
import { getCollectionByHandle, listCollectionProducts } from '@/lib/collections'
import { inStore } from '@/lib/store-context'

type Params = {
  params: Promise<{ storeId: string; handle: string }>
  searchParams: Promise<{ sort?: string; page?: string }>
}

function parseSort(value: string | undefined, fallback: string): string {
  return SORT_OPTIONS.some((o) => o.value === value) ? (value as string) : fallback
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { storeId, handle } = await params
  const found = await inStore(storeId, (tx) => getCollectionByHandle(tx, handle))
  if (!found) return {}
  return {
    title: found.seoTitle ?? found.title,
    description: found.seoDescription ?? undefined,
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
  const pages = Math.max(1, Math.ceil(products.total / COLLECTION_PER_PAGE))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: collection.title,
    description: collection.seoDescription ?? undefined,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: products.total,
      itemListElement: products.items.map((p, i) => ({
        '@type': 'ListItem',
        position: (page - 1) * COLLECTION_PER_PAGE + i + 1,
        url: `/products/${p.handle}`,
        name: p.title,
      })),
    },
  }

  return (
    <section className="section-collection page-width">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from our own data; JSON.stringify escapes it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\u003c') }}
      />
      <header className="collection__header">
        <h1 className="collection__title h2">{collection.title}</h1>
        {collection.description ? (
          <RichTextRenderer
            data={parseRichText(collection.description)}
            className="collection__description rte"
          />
        ) : null}
        <div className="collection__toolbar">
          <span className="text-caption">{copy.productCount(products.total)}</span>
          <CollectionSort value={sort} />
        </div>
      </header>

      <CollectionGrid products={products.items} />

      {pages > 1 ? (
        <nav className="collection__pagination" aria-label={copy.pageOf(page, pages)}>
          {page > 1 ? (
            <Link
              className="btn btn--secondary btn--pill"
              href={`/collections/${handle}?sort=${sort}&page=${page - 1}`}
            >
              {copy.previous}
            </Link>
          ) : null}
          <span className="text-caption">{copy.pageOf(page, pages)}</span>
          {page < pages ? (
            <Link
              className="btn btn--secondary btn--pill"
              href={`/collections/${handle}?sort=${sort}&page=${page + 1}`}
            >
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  )
}
