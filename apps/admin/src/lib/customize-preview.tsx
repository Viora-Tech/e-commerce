import {
  Footer,
  Header,
  type NavLink,
  type ProductDetail,
  ProductView,
  RichTextBlock,
  SectionFrame,
  TabbedProducts,
} from '@commerce/blocks'
import type { CardProduct, SectionMetadata } from '@commerce/blocks/puck'
import { customizeContent } from '@/data/customize'

/** Store data the preview header and footer draw from (`themes.templates.previewContext`). */
export type PreviewContext = {
  storeName: string
  navLinks: NavLink[]
  footerColumns: {
    id: string
    heading: string
    links: { id: string; label: string; href: string }[]
  }[]
}

/** The resource the merchant chose to preview a product, collection or page template with. */
export type PreviewResource =
  | { kind: 'product'; product: ProductDetail }
  | { kind: 'collection'; title: string; cards: CardProduct[] }
  | { kind: 'page'; title: string; body: unknown }
  | null

type PreviewOptions = {
  context: PreviewContext | null
  resource: PreviewResource
  logo: { url: string; width: number } | null
  /** The store's active products, for product rows that depend on the shopper. */
  cards: CardProduct[]
}

const copy = customizeContent

/** A labelled band where a section needs data the editor does not load (blog posts, cart). */
const placeholder = (name: string) => (
  <SectionFrame padTop={64} padBottom={64}>
    <div className="page-width">
      <p className="h4">{copy.preview.mainPlaceholder(name)}</p>
    </div>
  </SectionFrame>
)

const pickFirst = placeholder

const count = (value: unknown) => (typeof value === 'number' ? value : 4)

const row = (heading: string, products: CardProduct[]) => (
  <SectionFrame padTop={48} padBottom={48}>
    <TabbedProducts heading={heading} tabs={[{ label: heading, products }]} />
  </SectionFrame>
)

const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback)

/**
 * Renderers for the dynamic sections inside the Customize preview. The storefront
 * renders the same sections from the database; here they draw from what the
 * editor fetched through the API, so every section stays selectable and editable.
 */
export function previewMetadata({
  context,
  resource,
  logo,
  cards,
}: PreviewOptions): SectionMetadata {
  return {
    renderers: {
      Header: () => (
        <Header
          storeName={context?.storeName ?? ''}
          links={context?.navLinks ?? []}
          themeMode="light"
          showThemeToggle={false}
          cartCount={0}
          logo={logo}
        />
      ),
      Footer: (s) => (
        <Footer
          storeName={context?.storeName ?? ''}
          tagline={text(s.tagline)}
          columns={context?.footerColumns ?? []}
        />
      ),
      MainProduct: () =>
        resource?.kind === 'product' ? (
          <ProductView product={resource.product} />
        ) : (
          pickFirst(copy.templates.names.product)
        ),
      MainCollection: () =>
        resource?.kind === 'collection' ? (
          <SectionFrame padTop={32} padBottom={48}>
            <TabbedProducts
              heading={resource.title}
              tabs={[{ label: resource.title, products: resource.cards }]}
            />
          </SectionFrame>
        ) : (
          pickFirst(copy.templates.names.collection)
        ),
      MainPage: (s) =>
        resource?.kind === 'page' ? (
          <SectionFrame padTop={48} padBottom={48}>
            <div className="page-width">
              <RichTextBlock
                heading={s.showTitle === false ? '' : resource.title}
                body={resource.body as never}
                align="left"
              />
            </div>
          </SectionFrame>
        ) : (
          pickFirst(copy.templates.names.page)
        ),
      MainBlog: () => placeholder(copy.templates.names.blog),
      MainArticle: () => placeholder(copy.templates.names.article),
      MainCart: () => placeholder(copy.templates.names.cart),
      MainSearch: () => placeholder(copy.templates.names.search),
      MainNotFound: () => placeholder(copy.templates.names.not_found),
      RelatedProducts: (s) => {
        const current = resource?.kind === 'product' ? resource.product : null
        const related = cards.filter(
          (c) =>
            c.id !== current?.id &&
            (!current?.productType || c.productType === current.productType),
        )
        return row(text(s.heading), related.slice(0, count(s.limit)))
      },
      // The shopper's history is unknown here; the first products stand in for it.
      RecentlyViewed: (s) => row(text(s.heading), cards.slice(0, count(s.limit))),
    },
  }
}
