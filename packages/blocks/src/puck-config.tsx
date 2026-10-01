import type { RichTextValue } from '@commerce/richtext'
import type { Config, Data } from '@puckeditor/core'
import { type AppBlockOwner, type AppBlockSource, buildAppBlocks } from './app-blocks'
import { type ArticleLoader, type BlogPostsProps, blogPostsBlock } from './blog-posts-block'
import ProductCard from './components/product-card'
import TabbedProducts from './components/product-grid'
import RichTextBlock from './components/rich-text'
import SectionFrame from './components/section-frame'
import SectionHeading from './components/section-heading'
import {
  defaultSectionSettings,
  migrateSectionSettings,
  type SectionSettingsValue,
  sectionSettingsField,
} from './section-settings'
import { type CustomProps, customSections, ELEMENT_BLOCKS, LAYOUT_BLOCKS } from './sections/custom'
import { type DynamicSection, dynamicSections, type SectionSettings } from './sections/dynamic'
import { GLIDE_SECTIONS, type GlideProps, glideSections } from './sections/glide'
import { liquidSectionConfig } from './sections/liquid'
import { type ProductGridProps, tabbedProductsSection } from './sections/glide/tabbed-products'
import {
  GLIDE_PRODUCT_SECTIONS,
  type GlideProductProps,
  glideProductSections,
} from './sections/glide-product'
import { type HeroProps, heroBlock } from './sections/hero-block'
import {
  type CollectionLoader,
  type LibraryProps,
  librarySections,
  type SingleProductLoader,
} from './sections/library'
import { type ModernProps, modernSections } from './sections/modern'
import { type RichTextFieldEditor, richTextField } from './sections/rich-text-field'
import type { CardProduct } from './types'

export type { ArticleLoader, BlogPostsProps } from './blog-posts-block'
export type { NewsletterAction, NewsletterState } from './components/sections/newsletter'
export {
  defaultSectionSettings,
  type LegacySectionProps,
  migrateSectionSettings,
  type SectionSettingsValue,
  sectionSettingsField,
} from './section-settings'
export {
  type CustomBlockType,
  type CustomProps,
  ELEMENT_BLOCKS,
  LAYOUT_BLOCKS,
  SLOT_DISALLOW,
} from './sections/custom'
export {
  DYNAMIC_SECTIONS,
  type DynamicSection,
  type SectionMetadata,
  type SectionRenderer,
  type SectionSettings,
} from './sections/dynamic'
export { GLIDE_SECTIONS, type GlideProps } from './sections/glide'
export type { ProductGridProps } from './sections/glide/tabbed-products'
export { GLIDE_PRODUCT_SECTIONS, type GlideProductProps } from './sections/glide-product'
export type { CollectionLoader, LibraryProps, SingleProductLoader } from './sections/library'
export type { ModernProps } from './sections/modern'
export type { SectionSource } from './sections/sources'
export { SECTION_SOURCES } from './sections/sources'
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

/** Same `settings` field every `packages/blocks/src/sections/library.tsx` section carries. */
export const frameFields = { settings: sectionSettingsField(SCHEMES) } as const

export type Frame = { settings: SectionSettingsValue }

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

export type { RichTextFieldEditor } from './sections/rich-text-field'

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
  GlideProps &
  GlideProductProps &
  ModernProps &
  CustomProps &
  Record<DynamicSection | 'LiquidSection', SectionSettings>

/**
 * The add-section menu, in Shopify's order. Main sections and the header and
 * footer are placed by their template or group, never added from here.
 */
export const SECTION_CATEGORIES = {
  // Rebuilt from our own Shopify theme (Zero Drift, formerly Glide); see ./sections/glide.tsx.
  glide: { title: 'Zero Drift theme', components: GLIDE_SECTIONS },
  banners: {
    title: 'Banners',
    components: [
      'Hero',
      'ImageBanner',
      'ImageWithText',
      'AnnouncementBar',
      'SpotlightHero',
      'SplitHero',
      'VideoHero',
      'CtaBanner',
    ],
  },
  text: {
    title: 'Text',
    components: [
      'RichText',
      'Multicolumn',
      'Testimonials',
      'Faq',
      'LogoList',
      'BentoGrid',
      'StatsCounter',
      'FaqAccordion',
      'TestimonialMarquee',
      'LogoMarquee',
    ],
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
      // The Zero Drift theme's product-page sections; see ./sections/glide-product.tsx.
      ...GLIDE_PRODUCT_SECTIONS,
    ],
  },
  media: { title: 'Media', components: ['Video', 'Gallery'] },
  more: { title: 'More', components: ['BlogPosts', 'Newsletter'] },
  // Build your own: containers whose content is slots, and the elements that go in them.
  layout: { title: 'Layout', components: LAYOUT_BLOCKS },
  elements: { title: 'Elements', components: ELEMENT_BLOCKS },
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
      glide: { ...SECTION_CATEGORIES.glide, components: [...SECTION_CATEGORIES.glide.components] },
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
      layout: {
        ...SECTION_CATEGORIES.layout,
        components: [...SECTION_CATEGORIES.layout.components],
      },
      elements: {
        ...SECTION_CATEGORIES.elements,
        components: [...SECTION_CATEGORIES.elements.components],
      },
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
      ...(glideSections({
        loadProducts,
        loadCollections: options.loadCollections,
        loadProduct: options.loadProduct,
        loadArticles: options.loadArticles,
      }) as unknown as Pick<Config<BlockProps>['components'], keyof GlideProps>),
      ...(modernSections() as unknown as Pick<Config<BlockProps>['components'], keyof ModernProps>),
      ...(customSections({
        RichTextEditor: options.RichTextEditor,
        loadProduct: options.loadProduct,
      }) as unknown as Pick<Config<BlockProps>['components'], keyof CustomProps>),
      ...(glideProductSections() as unknown as Pick<
        Config<BlockProps>['components'],
        keyof GlideProductProps
      >),
      ...(dynamicSections() as unknown as Pick<Config<BlockProps>['components'], DynamicSection>),
      // Sections of an imported Shopify theme; see ./sections/liquid.tsx.
      LiquidSection: liquidSectionConfig as unknown as Config<BlockProps>['components']['LiquidSection'],
      Hero: heroBlock({ loadProduct: options.loadProduct }),

      // Glide's tabbed-products section; config in ./sections/glide/tabbed-products.tsx.
      ProductGrid: tabbedProductsSection({
        loadProducts,
        loadCollections: options.loadCollections,
      }) as unknown as Config<BlockProps>['components']['ProductGrid'],

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
          settings: defaultSectionSettings({ padTop: 48, padBottom: 48 }),
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
        render: ({ kicker, heading, resolved, ...props }) => (
          <SectionFrame settings={migrateSectionSettings(props)}>
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
          settings: defaultSectionSettings({ padTop: 56, padBottom: 56 }),
        },
        resolveData: async ({ props }) => ({
          props: {
            resolved: props.collectionHandle
              ? await loadProducts({ collectionHandle: props.collectionHandle, limit: props.limit })
              : [],
          },
          readOnly: { resolved: true },
        }),
        render: ({ heading, columns, resolved, ...props }) => (
          <SectionFrame settings={migrateSectionSettings(props)}>
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
          settings: defaultSectionSettings({ padTop: 48, padBottom: 48 }),
        },
        render: ({ heading, body, align, ...props }) => (
          <SectionFrame settings={migrateSectionSettings(props)}>
            <div className="page-width">
              <RichTextBlock heading={heading} body={body} align={align} />
            </div>
          </SectionFrame>
        ),
      },
    },
  }
}
