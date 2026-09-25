import type { RichTextValue } from '@commerce/richtext'
import type { Config, CustomField, Data } from '@puckeditor/core'
import type { ComponentType } from 'react'
import { type AppBlockOwner, type AppBlockSource, buildAppBlocks } from './app-blocks'
import { type ArticleLoader, type BlogPostsProps, blogPostsBlock } from './blog-posts-block'
import HeroCarousel, { type HeroSlide } from './components/hero-carousel'
import ProductCard from './components/product-card'
import TabbedProducts from './components/product-grid'
import RichTextBlock from './components/rich-text'
import SectionFrame from './components/section-frame'
import SectionHeading from './components/section-heading'
import { type DynamicSection, dynamicSections, type SectionSettings } from './sections/dynamic'
import {
  type CollectionLoader,
  type LibraryProps,
  librarySections,
  type SingleProductLoader,
} from './sections/library'
import type { CardProduct } from './types'

export type { ArticleLoader, BlogPostsProps } from './blog-posts-block'
export type { NewsletterAction, NewsletterState } from './components/sections/newsletter'
export {
  DYNAMIC_SECTIONS,
  type DynamicSection,
  type SectionMetadata,
  type SectionRenderer,
  type SectionSettings,
} from './sections/dynamic'
export type { CollectionLoader, LibraryProps, SingleProductLoader } from './sections/library'
export type { CardCollection, CardProduct } from './types'

/**
 * How a block gets product data. The storefront supplies a database-backed
 * loader; the admin editor supplies one that calls the API. Blocks never
 * fetch on their own, so server rendering stays synchronous.
 */
export type ProductLoader = (query: {
  productType?: string | undefined
  /** Set by the collection block; the loader reads membership rather than type. */
  collectionHandle?: string | undefined
  limit: number
}) => Promise<CardProduct[]>

const SCHEMES = [
  { label: 'Default', value: 'scheme-1' },
  { label: 'Night', value: 'scheme-2' },
  { label: 'Charcoal', value: 'scheme-3' },
  { label: 'Purple', value: 'scheme-4' },
  { label: 'Mist', value: 'scheme-5' },
]

export const frameFields = {
  scheme: { type: 'select', label: 'Colour scheme', options: SCHEMES },
  padTop: { type: 'number', label: 'Padding top', min: 0, max: 160 },
  padBottom: { type: 'number', label: 'Padding bottom', min: 0, max: 160 },
} as const

export type Frame = { scheme: string; padTop: number; padBottom: number }

export type HeroProps = {
  slides: HeroSlide[]
  autoplaySeconds: number
  heightVh: number
}

export type ProductGridProps = Frame & {
  heading: string
  tabs: { label: string; productType: string; limit: number }[]
  columns: number
  /** Filled by resolveData; not edited directly. */
  resolved?: { label: string; products: CardProduct[] }[]
}

export type FeaturedProductsProps = Frame & {
  kicker: string
  heading: string
  productType: string
  limit: number
  resolved?: CardProduct[]
}

export type CollectionGridProps = Frame & {
  heading: string
  collectionHandle: string
  limit: number
  columns: number
  resolved?: CardProduct[]
}

export type RichTextProps = Frame & {
  heading: string
  /** Lexical JSON. Older pages may still hold a plain string; the block renders both. */
  body: RichTextValue | string
  align: 'left' | 'center'
}

/** A field editor the host supplies (admin passes the Lexical editor). */
export type RichTextFieldEditor = ComponentType<{
  value: RichTextValue | null | undefined
  onChange: (value: RichTextValue) => void
  placeholder?: string | undefined
}>

export type BlocksConfigOptions = {
  /**
   * Editor for rich-text fields. Only the admin needs it; the storefront
   * renders published data and never shows a field, so it leaves this out
   * and keeps the client editor out of its bundle.
   */
  RichTextEditor?: RichTextFieldEditor | undefined
  /** Posts for the "Blog posts" block; without it the block renders nothing. */
  loadArticles?: ArticleLoader | undefined
  /** Collections for the collection list section. */
  loadCollections?: CollectionLoader | undefined
  /** One product for the featured product section. */
  loadProduct?: SingleProductLoader | undefined
}

export type BlockProps = {
  Hero: HeroProps
  ProductGrid: ProductGridProps
  FeaturedProducts: FeaturedProductsProps
  CollectionGrid: CollectionGridProps
  RichText: RichTextProps
  BlogPosts: BlogPostsProps
} & LibraryProps &
  Record<DynamicSection, SectionSettings>

/**
 * The add-section menu, in Shopify's order. Main sections and the header and
 * footer are placed by their template or group, never added from here.
 */
export const SECTION_CATEGORIES = {
  banners: {
    title: 'Banners',
    components: ['Hero', 'ImageBanner', 'ImageWithText', 'AnnouncementBar'],
  },
  text: {
    title: 'Text',
    components: ['RichText', 'Multicolumn', 'Testimonials', 'Faq', 'LogoList'],
  },
  products: {
    title: 'Products',
    components: [
      'ProductGrid',
      'FeaturedProducts',
      'CollectionGrid',
      'FeaturedProduct',
      'CollectionList',
      'RelatedProducts',
      'RecentlyViewed',
    ],
  },
  media: { title: 'Media', components: ['Video'] },
  more: { title: 'More', components: ['BlogPosts', 'Newsletter'] },
} as const

/**
 * App blocks (Shopify's "app blocks"): sections the plugin SDK's
 * `storefront.blocks` registers for merchants to add from installed apps,
 * kept in their own Puck category so the Add panel can show them on a
 * separate "Apps" tab. `createBlocksConfig`'s `appBlockSources` builds
 * `categories.apps` and the returned config's `appBlockOwners` (the Add
 * panel's per-block "by <app>" grouping) live, from enabled plugins only —
 * see `buildAppBlocks` in `./app-blocks` for the pure builder and
 * docs/plugins.md for how a plugin registers one.
 */
export const APPS_CATEGORY = 'apps'
export type { AppBlockOwner, AppBlockSource } from './app-blocks'
export { buildAppBlocks } from './app-blocks'

export type PageData = Data<BlockProps>

function richTextField(
  Editor: RichTextFieldEditor | undefined,
): CustomField<RichTextValue | string> {
  return {
    type: 'custom',
    label: 'Body',
    render: ({ value, onChange }) =>
      Editor ? (
        <Editor
          value={typeof value === 'string' ? null : value}
          onChange={onChange}
          placeholder="Write the section text…"
        />
      ) : (
        <textarea readOnly value={typeof value === 'string' ? value : JSON.stringify(value)} />
      ),
  }
}

export type BlocksConfig = Config<BlockProps> & {
  /** Which app owns each enabled app block, for the Add panel's "by <app>" grouping. */
  appBlockOwners: Record<string, AppBlockOwner>
}

/**
 * Build the Puck config. `loadProducts` resolves product blocks (editor +
 * storefront). `appBlockSources` is every plugin the deployment ships that
 * declares `storefront.blocks` (both storefront and the admin editor pass
 * it — see `apps/storefront/src/lib/template-render.tsx` and
 * `apps/admin/src/lib/customize-config.tsx`); `enabledAppIds` is which of
 * those the current store installed. Leave both out for a config with no app
 * blocks (tests, a template with no store context).
 */
export function createBlocksConfig(
  loadProducts: ProductLoader,
  options: BlocksConfigOptions = {},
  appBlockSources: AppBlockSource[] = [],
  enabledAppIds: ReadonlySet<string> = new Set(),
): BlocksConfig {
  const appBlocks = buildAppBlocks(appBlockSources, enabledAppIds)
  return {
    appBlockOwners: appBlocks.owners,
    categories: {
      banners: {
        ...SECTION_CATEGORIES.banners,
        components: [...SECTION_CATEGORIES.banners.components],
      },
      text: { ...SECTION_CATEGORIES.text, components: [...SECTION_CATEGORIES.text.components] },
      products: {
        ...SECTION_CATEGORIES.products,
        components: [...SECTION_CATEGORIES.products.components],
      },
      media: { ...SECTION_CATEGORIES.media, components: [...SECTION_CATEGORIES.media.components] },
      more: { ...SECTION_CATEGORIES.more, components: [...SECTION_CATEGORIES.more.components] },
      // App block types are dynamic (one per installed plugin's block), so the category's
      // components list is cast the same way `components` below is for library/dynamic sections.
      [APPS_CATEGORY]: {
        title: 'Apps',
        components: appBlocks.categoryComponents as unknown as (keyof BlockProps)[],
      },
    },
    components: {
      // App blocks type their props loosely too; each plugin owns its own shape.
      ...(appBlocks.components as unknown as Pick<Config<BlockProps>['components'], never>),
      // Library and dynamic sections type their props loosely; their renderers own the shapes.
      ...(librarySections({
        loadCollections: options.loadCollections,
        loadProduct: options.loadProduct,
      }) as unknown as Pick<Config<BlockProps>['components'], keyof LibraryProps>),
      ...(dynamicSections() as unknown as Pick<Config<BlockProps>['components'], DynamicSection>),
      Hero: {
        label: 'Hero carousel',
        fields: {
          slides: {
            type: 'array',
            label: 'Slides',
            getItemSummary: (s) => s.heading || 'Slide',
            arrayFields: {
              heading: { type: 'text', label: 'Heading' },
              subheading: { type: 'textarea', label: 'Subheading' },
              image: {
                type: 'object',
                label: 'Image',
                objectFields: {
                  url: { type: 'text', label: 'URL' },
                  alt: { type: 'text', label: 'Alt text' },
                },
              },
              cta: {
                type: 'object',
                label: 'Primary button',
                objectFields: {
                  label: { type: 'text', label: 'Label' },
                  href: { type: 'text', label: 'Link' },
                },
              },
              cta2: {
                type: 'object',
                label: 'Secondary button',
                objectFields: {
                  label: { type: 'text', label: 'Label' },
                  href: { type: 'text', label: 'Link' },
                },
              },
              textPosition: {
                type: 'radio',
                label: 'Text position',
                options: [
                  { label: 'Left', value: 'left' },
                  { label: 'Center', value: 'center' },
                  { label: 'Right', value: 'right' },
                ],
              },
            },
          },
          autoplaySeconds: {
            type: 'number',
            label: 'Autoplay (seconds, 0 = off)',
            min: 0,
            max: 30,
          },
          heightVh: { type: 'number', label: 'Height (vh)', min: 40, max: 100 },
        },
        defaultProps: {
          slides: [
            {
              heading: 'Glide faster',
              subheading: "India's glasspad specialist.",
              image: { url: '', alt: '' },
              cta: { label: 'Shop now', href: '/collections/all' },
              textPosition: 'left',
            },
          ],
          autoplaySeconds: 5,
          heightVh: 72,
        },
        render: ({ slides, autoplaySeconds, heightVh }) => (
          <HeroCarousel
            slides={slides.map(({ cta, cta2, ...s }) => ({
              ...s,
              ...(cta?.label ? { cta } : {}),
              ...(cta2?.label ? { cta2 } : {}),
            }))}
            autoplaySeconds={autoplaySeconds}
            heightVh={heightVh}
          />
        ),
      },

      ProductGrid: {
        label: 'Tabbed product grid',
        fields: {
          heading: { type: 'text', label: 'Heading' },
          tabs: {
            type: 'array',
            label: 'Tabs',
            getItemSummary: (t) => t.label || 'Tab',
            arrayFields: {
              label: { type: 'text', label: 'Tab label' },
              productType: { type: 'text', label: 'Product type (blank = all)' },
              limit: { type: 'number', label: 'Products', min: 1, max: 24 },
            },
          },
          columns: { type: 'number', label: 'Columns', min: 2, max: 5 },
          ...frameFields,
        },
        defaultProps: {
          heading: 'Shop the range',
          tabs: [{ label: 'All', productType: '', limit: 8 }],
          columns: 4,
          scheme: 'scheme-5',
          padTop: 56,
          padBottom: 56,
        },
        resolveData: async ({ props }) => {
          const resolved = await Promise.all(
            props.tabs.map(async (t) => ({
              label: t.label,
              products: await loadProducts({
                productType: t.productType || undefined,
                limit: t.limit,
              }),
            })),
          )
          return { props: { resolved }, readOnly: { resolved: true } }
        },
        render: ({ heading, columns, resolved, scheme, padTop, padBottom }) => (
          <SectionFrame scheme={scheme} padTop={padTop} padBottom={padBottom}>
            <TabbedProducts heading={heading} columns={columns} tabs={resolved ?? []} />
          </SectionFrame>
        ),
      },

      FeaturedProducts: {
        label: 'Featured products',
        fields: {
          kicker: { type: 'text', label: 'Kicker' },
          heading: { type: 'text', label: 'Heading' },
          productType: { type: 'text', label: 'Product type (blank = all)' },
          limit: { type: 'number', label: 'Products', min: 1, max: 12 },
          ...frameFields,
        },
        defaultProps: {
          kicker: 'New in',
          heading: 'Latest drops',
          productType: '',
          limit: 4,
          scheme: 'scheme-1',
          padTop: 48,
          padBottom: 48,
        },
        resolveData: async ({ props }) => ({
          props: {
            resolved: await loadProducts({
              productType: props.productType || undefined,
              limit: props.limit,
            }),
          },
          readOnly: { resolved: true },
        }),
        render: ({ kicker, heading, resolved, scheme, padTop, padBottom }) => (
          <SectionFrame scheme={scheme} padTop={padTop} padBottom={padBottom}>
            <div className="page-width">
              <SectionHeading kicker={kicker} heading={heading} />
              <div
                className="tabbed-products__grid"
                style={{ '--columns': 4 } as React.CSSProperties}
              >
                {(resolved ?? []).map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          </SectionFrame>
        ),
      },

      CollectionGrid: {
        label: 'Collection grid',
        fields: {
          heading: { type: 'text', label: 'Heading' },
          collectionHandle: { type: 'text', label: 'Collection handle' },
          limit: { type: 'number', label: 'Products', min: 1, max: 24 },
          columns: { type: 'number', label: 'Columns', min: 2, max: 5 },
          ...frameFields,
        },
        defaultProps: {
          heading: 'Shop the collection',
          collectionHandle: '',
          limit: 8,
          columns: 4,
          scheme: 'scheme-1',
          padTop: 56,
          padBottom: 56,
        },
        resolveData: async ({ props }) => ({
          props: {
            resolved: props.collectionHandle
              ? await loadProducts({ collectionHandle: props.collectionHandle, limit: props.limit })
              : [],
          },
          readOnly: { resolved: true },
        }),
        render: ({ heading, columns, resolved, scheme, padTop, padBottom }) => (
          <SectionFrame scheme={scheme} padTop={padTop} padBottom={padBottom}>
            <TabbedProducts
              heading={heading}
              columns={columns}
              tabs={[{ label: heading, products: resolved ?? [] }]}
            />
          </SectionFrame>
        ),
      },

      BlogPosts: blogPostsBlock(frameFields, options.loadArticles),

      RichText: {
        label: 'Rich text',
        fields: {
          heading: { type: 'text', label: 'Heading' },
          body: richTextField(options.RichTextEditor),
          align: {
            type: 'radio',
            label: 'Align',
            options: [
              { label: 'Left', value: 'left' },
              { label: 'Center', value: 'center' },
            ],
          },
          ...frameFields,
        },
        defaultProps: {
          heading: '',
          body: '',
          align: 'center',
          scheme: 'scheme-1',
          padTop: 48,
          padBottom: 48,
        },
        render: ({ heading, body, align, scheme, padTop, padBottom }) => (
          <SectionFrame scheme={scheme} padTop={padTop} padBottom={padBottom}>
            <div className="page-width">
              <RichTextBlock heading={heading} body={body} align={align} />
            </div>
          </SectionFrame>
        ),
      },
    },
  }
}
