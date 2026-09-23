import { parseRichText, RichTextRenderer } from '@commerce/richtext'
import Link from 'next/link'
import { COLLECTION_PER_PAGE, collectionsContent as copy } from '@/data/collections'
import type { CollectionDetail, CollectionProducts } from '@/lib/collections'
import { collectionGraph, jsonLd } from '@/lib/seo'
import CollectionGrid from './collection-grid'
import CollectionSort from './collection-sort'

type MainCollectionProps = {
  handle: string
  /** The shopper-facing origin, for absolute URLs in the structured data. */
  origin: string
  collection: CollectionDetail
  products: CollectionProducts
  sort: string
  page: number
  /** The section's settings from the collection template. */
  settings: { showDescription?: unknown; showSort?: unknown; showImage?: unknown }
}

/** The collection template's main section: banner, sort, product grid and pagination. */
export default function MainCollection({
  handle,
  origin,
  collection,
  products,
  sort,
  page,
  settings,
}: MainCollectionProps) {
  // Render logic
  const pages = Math.max(1, Math.ceil(products.total / COLLECTION_PER_PAGE))
  const schema = collectionGraph(
    {
      handle,
      title: collection.title,
      description: collection.seoDescription ?? undefined,
    },
    products.items,
    (page - 1) * COLLECTION_PER_PAGE + 1,
    products.total,
    origin,
  )

  return (
    <section className="section-collection page-width">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from our own data; jsonLd() escapes it.
        dangerouslySetInnerHTML={jsonLd(schema)}
      />
      <header className="collection__header">
        <h1 className="collection__title h2">{collection.title}</h1>
        {settings.showImage === true && collection.imageUrl ? (
          // biome-ignore lint/performance/noImgElement: collection images come from the store's media host, as in the blocks package.
          <img
            className="mb-6 aspect-[3/1] w-full rounded-2xl object-cover"
            src={collection.imageUrl}
            alt=""
          />
        ) : null}
        {collection.description && settings.showDescription !== false ? (
          <RichTextRenderer
            data={parseRichText(collection.description)}
            className="collection__description rte"
          />
        ) : null}
        <div className="collection__toolbar">
          <span className="text-caption">{copy.productCount(products.total)}</span>
          {settings.showSort === false ? null : <CollectionSort value={sort} />}
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
