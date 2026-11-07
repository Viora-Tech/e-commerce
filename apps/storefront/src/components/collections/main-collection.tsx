import { Breadcrumbs, type CardProduct } from '@commerce/blocks'
import type { BrowseResult, ThemeCardSection } from '@commerce/core'
import type { BrowseFilters, BrowseSort } from '@commerce/core/browse'
import { parseRichText, RichTextRenderer } from '@commerce/richtext'
import BrowseResults from '@/components/browse/browse-results'
import { browseContent, COLLECTION_SORTS } from '@/data/browse'
import { COLLECTION_PER_PAGE } from '@/data/collections'
import type { CollectionDetail } from '@/lib/collections'
import { themeCardsFor } from '@/lib/liquid-cards'
import { collectionGraph, jsonLd } from '@/lib/seo'

type MainCollectionProps = {
  storeId: string
  /** The shopper-facing origin, for absolute URLs in the structured data. */
  origin: string
  collection: CollectionDetail
  products: CardProduct[]
  result: BrowseResult
  filters: BrowseFilters
  sort: BrowseSort
  defaultSort: BrowseSort
  page: number
  /** The section's settings from the collection template. */
  settings: {
    showDescription?: unknown
    showSort?: unknown
    showImage?: unknown
    showFilters?: unknown
    showBreadcrumbs?: unknown
    uppercaseTitle?: unknown
    columns?: unknown
    columnsMobile?: unknown
    /** An imported theme's own main collection sections, kept by the import (#1047). */
    _themeSections?: unknown
  }
}

const count = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)

/** The import's `_themeSections` as the card render reads them; anything malformed left out. */
function themeSections(value: unknown): ThemeCardSection[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((v) =>
    v && typeof v === 'object' && typeof v.type === 'string' && typeof v.key === 'string'
      ? [
          {
            type: v.type,
            key: v.key,
            settings: v.settings && typeof v.settings === 'object' ? v.settings : {},
            ...(Array.isArray(v.blocks) ? { blocks: v.blocks } : {}),
          },
        ]
      : [],
  )
}

/** The collection template's main section: banner, filters, sort, product grid and pagination. */
export default async function MainCollection({
  storeId,
  origin,
  collection,
  products,
  result,
  filters,
  sort,
  defaultSort,
  page,
  settings,
}: MainCollectionProps) {
  // Hooks
  // On an imported theme each card is the theme's own (its rating, sale pill, quick add).
  const themeCards = await themeCardsFor(storeId, {
    handles: products.map((p) => p.handle),
    sections: themeSections(settings._themeSections),
  })

  // Render logic
  const schema = collectionGraph(
    {
      handle: collection.handle,
      title: collection.title,
      description: collection.seoDescription ?? undefined,
    },
    products,
    (page - 1) * COLLECTION_PER_PAGE + 1,
    result.total,
    origin,
  )

  return (
    <section className="section-collection page-width">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from our own data; jsonLd() escapes it.
        dangerouslySetInnerHTML={jsonLd(schema)}
      />
      {settings.showBreadcrumbs === false ? null : (
        <Breadcrumbs
          items={[
            { label: browseContent.collections, href: '/collections' },
            { label: collection.title },
          ]}
        />
      )}
      <header className="collection__header">
        <h1 className={`collection__title${settings.uppercaseTitle === true ? ' uppercase!' : ''}`}>
          {collection.title}
        </h1>
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
        <p className="collection__count">{browseContent.productCount(result.total)}</p>
      </header>

      <BrowseResults
        path={`/collections/${collection.handle}`}
        products={products}
        total={result.total}
        facets={result.facets}
        filterConfig={result.filterConfig}
        filters={filters}
        sort={sort}
        defaultSort={defaultSort}
        sorts={COLLECTION_SORTS}
        page={page}
        perPage={COLLECTION_PER_PAGE}
        showFilters={settings.showFilters !== false}
        showSort={settings.showSort !== false}
        showCount={false}
        grid={{
          columns: count(settings.columns),
          columnsMobile: count(settings.columnsMobile),
          themeCards,
        }}
      />
    </section>
  )
}
