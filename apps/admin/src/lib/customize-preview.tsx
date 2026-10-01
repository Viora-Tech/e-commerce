import {
  cookieBannerSettings,
  Footer,
  footerSettings,
  GlideCookieBanner,
  Header,
  headerSettings,
  mainProductSettings,
  type NavLink,
  type ProductDetail,
  ProductRecommendations,
  ProductView,
  RichTextBlock,
  SectionFrame,
  TabbedProducts,
} from '@commerce/blocks'
import type { CardProduct, SectionMetadata } from '@commerce/blocks/puck'
import { isValidElement } from 'react'
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

/** The heading arrives as Puck's inline editor (a node) on the canvas; anything else is dropped. */
const row = (heading: unknown, products: CardProduct[]) => (
  <ProductRecommendations
    heading={typeof heading === 'string' || isValidElement(heading) ? heading : ''}
    products={products}
  />
)

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
      Header: (s) => (
        <Header
          storeName={context?.storeName ?? ''}
          links={context?.navLinks ?? []}
          themeMode="light"
          showThemeToggle={false}
          cartCount={0}
          logo={logo}
          settings={headerSettings(s)}
        />
      ),
      Footer: (s) => (
        <Footer
          {...footerSettings(s)}
          storeName={context?.storeName ?? ''}
          columns={context?.footerColumns ?? []}
          cookieSettings={{ label: copy.preview.cookieSettings, href: '#' }}
          logo={logo}
        />
      ),
      // The live banner only runs on the storefront; here it is a still picture to edit.
      CookieBanner: (s) => <GlideCookieBanner {...cookieBannerSettings(s)} />,
      MainProduct: (s) =>
        resource?.kind === 'product' ? (
          <ProductView product={resource.product} settings={mainProductSettings(s)} />
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
        // An empty row would vanish from the canvas; other products keep it selectable.
        return row(s.heading, (related.length ? related : cards).slice(0, count(s.limit)))
      },
      // The shopper's history is unknown here; the first products stand in for it.
      RecentlyViewed: (s) => row(s.heading, cards.slice(0, count(s.limit))),
    },
    // Product page sections (tabs, specs, size guide...) draw from the previewed product.
    product: resource?.kind === 'product' ? resource.product : undefined,
  }
}
