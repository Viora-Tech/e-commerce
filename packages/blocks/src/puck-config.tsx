import type { Config, Data } from '@puckeditor/core'
import { type AppBlockOwner, type AppBlockSource, buildAppBlocks } from './app-blocks'
import { type ArticleLoader, type BlogPostsProps, blogPostsBlock } from './blog-posts-block'
import ProductCard from './components/product-card'
import TabbedProducts from './components/product-grid'
import RichTextBlock from './components/rich-text'
import SectionFrame from './components/section-frame'
import SectionHeading from './components/section-heading'
import { sectionCategories } from './section-categories'
import {
  defaultSectionSettings,
  migrateSectionSettings,
  type SectionSettingsValue,
  sectionSettingsField,
} from './section-settings'
import { type CustomProps, customSections } from './sections/custom'
import { type DynamicSection, dynamicSections, type SectionSettings } from './sections/dynamic'
import { type EngageProps, engageSections } from './sections/engage'
import { type HeroProps, heroBlock } from './sections/hero-block'
import { inlineRichtextLong, inlineText, type RichtextExtensions } from './sections/inline-fields'
import { type KitProps, kitSections } from './sections/kit'
import {
  type CollectionLoader,
  type LibraryProps,
  librarySections,
  type SingleProductLoader,
} from './sections/library'
import { liquidSectionConfig } from './sections/liquid'
import { type ModernProps, modernSections } from './sections/modern'
import {
  REVIEWS_APP_ID,
  REVIEWS_WIDGET_SECTIONS,
  type ReviewsWidgetProps,
  reviewsWidgetSections,
} from './sections/reviews-widgets'
import { type ZeroDriftProps, zeroDriftSections } from './sections/zero-drift'
import { type ProductGridProps, tabbedProductsSection } from './sections/zero-drift/tabbed-products'
import { type ZeroDriftProductProps, zeroDriftProductSections } from './sections/zero-drift-product'
import type { CardProduct, ReviewsLoader } from './types'

export type { ArticleLoader, BlogPostsProps } from './blog-posts-block'
export type { NewsletterAction, NewsletterState } from './components/sections/newsletter'
export { richtextFromLexical } from './lexical-html'
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
export type { EngageProps } from './sections/engage'
export type { KitProps } from './sections/kit'
export type { CollectionLoader, LibraryProps, SingleProductLoader } from './sections/library'
export type { ModernProps } from './sections/modern'
export {
  REVIEWS_WIDGET_SECTIONS,
  type ReviewsWidgetProps,
} from './sections/reviews-widgets'
export type { SectionSource } from './sections/sources'
export { SECTION_SOURCES } from './sections/sources'
export { ZERO_DRIFT_SECTIONS, type ZeroDriftProps } from './sections/zero-drift'
export type { ProductGridProps } from './sections/zero-drift/tabbed-products'
export {
  ZERO_DRIFT_PRODUCT_SECTIONS,
  type ZeroDriftProductProps,
} from './sections/zero-drift-product'
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
  /**
   * Richtext HTML (Puck's Tiptap field). Older pages may still hold a plain string or Lexical
   * JSON; `richtextHtml` renders all three and Customize converts them on load.
   */
  body: string | object
  align: 'left' | 'center'
}

export type BlocksConfigOptions = {
  /**
   * Extra Tiptap extensions for the long-form richtext fields (Rich text, Text). The admin
   * passes its image node so pictures in that copy survive editing; the storefront leaves it out.
   */
  richtextExtensions?: RichtextExtensions | undefined
  /** Posts for the "Blog posts" block; without it the block renders nothing. */
  loadArticles?: ArticleLoader | undefined
  /** Collections for the collection list section. */
  loadCollections?: CollectionLoader | undefined
  /** One product for the featured product section. */
  loadProduct?: SingleProductLoader | undefined
  /** Published reviews for the Reviews app's sections; without it they draw nothing. */
  loadReviews?: ReviewsLoader | undefined
  /**
   * The store's opt-in theme packs (`store.apps.settings.core.themePacks`). Only decides which
   * sections the Add menu offers (`sectionCategories`); every section still renders.
   */
  themePacks?: readonly string[] | undefined
}

export type BlockProps = {
  Hero: HeroProps
  ProductGrid: ProductGridProps
  FeaturedProducts: FeaturedProductsProps
  CollectionGrid: CollectionGridProps
  RichText: RichTextProps
  BlogPosts: BlogPostsProps
} & LibraryProps &
  ZeroDriftProps &
  ZeroDriftProductProps &
  ModernProps &
  EngageProps &
  KitProps &
  ReviewsWidgetProps &
  CustomProps &
  Record<DynamicSection | 'LiquidSection', SectionSettings>

export {
  hiddenPackSections,
  SECTION_CATEGORIES,
  type SectionCategory,
  type SectionCategoryId,
  sectionCategories,
  THEME_PACK_SECTIONS,
  ZERO_DRIFT_PACK,
} from './section-categories'

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
  // The Reviews app's sections sit on the Apps tab beside plugin blocks while it is installed.
  const reviewsOn = enabledAppIds.has(REVIEWS_APP_ID)
  const reviewsOwner = { appName: 'Reviews', appIcon: 'Star' }
  return {
    appBlockOwners: {
      ...appBlocks.owners,
      ...(reviewsOn
        ? Object.fromEntries(REVIEWS_WIDGET_SECTIONS.map((t) => [t, reviewsOwner]))
        : {}),
    },
    categories: {
      // Our own groups first; a theme pack's sections only for a store that turned it on.
      ...(sectionCategories(options.themePacks) as Record<
        string,
        { title: string; components: (keyof BlockProps)[] }
      >),
      // App block types are dynamic (one per installed plugin's block), so the category's
      // components list is cast the same way `components` below is for library/dynamic sections.
      [APPS_CATEGORY]: {
        title: 'Apps',
        components: [
          ...appBlocks.categoryComponents,
          ...(reviewsOn ? REVIEWS_WIDGET_SECTIONS : []),
        ] as unknown as (keyof BlockProps)[],
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
      ...(zeroDriftSections({
        loadProducts,
        loadCollections: options.loadCollections,
        loadProduct: options.loadProduct,
        loadArticles: options.loadArticles,
      }) as unknown as Pick<Config<BlockProps>['components'], keyof ZeroDriftProps>),
      ...(modernSections() as unknown as Pick<Config<BlockProps>['components'], keyof ModernProps>),
      ...(engageSections() as unknown as Pick<Config<BlockProps>['components'], keyof EngageProps>),
      ...(kitSections() as unknown as Pick<Config<BlockProps>['components'], keyof KitProps>),
      ...(reviewsWidgetSections(options.loadReviews) as unknown as Pick<
        Config<BlockProps>['components'],
        keyof ReviewsWidgetProps
      >),
      ...(customSections({
        loadProduct: options.loadProduct,
        richtextExtensions: options.richtextExtensions,
      }) as unknown as Pick<Config<BlockProps>['components'], keyof CustomProps>),
      ...(zeroDriftProductSections() as unknown as Pick<
        Config<BlockProps>['components'],
        keyof ZeroDriftProductProps
      >),
      ...(dynamicSections() as unknown as Pick<Config<BlockProps>['components'], DynamicSection>),
      // Sections of an imported Shopify theme; see ./sections/liquid.tsx.
      LiquidSection:
        liquidSectionConfig as unknown as Config<BlockProps>['components']['LiquidSection'],
      Hero: heroBlock({ loadProduct: options.loadProduct }),

      // Zero Drift's tabbed-products section; config in ./sections/zero-drift/tabbed-products.tsx.
      ProductGrid: tabbedProductsSection({
        loadProducts,
        loadCollections: options.loadCollections,
      }) as unknown as Config<BlockProps>['components']['ProductGrid'],

      FeaturedProducts: {
        label: 'Featured products',
        fields: {
          kicker: inlineText('Kicker'),
          heading: inlineText('Heading'),
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
          heading: inlineText('Heading'),
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
              headingFollowsTab={false}
              // The tab's name is also its panel's aria-label, so it needs the stored string;
              // while the heading is edited on the canvas that is a node, and the handle stands in.
              tabs={[
                {
                  label: typeof heading === 'string' ? heading : props.collectionHandle,
                  products: resolved ?? [],
                },
              ]}
            />
          </SectionFrame>
        ),
      },

      BlogPosts: blogPostsBlock(frameFields, options.loadArticles),

      RichText: {
        label: 'Rich text',
        fields: {
          heading: inlineText('Heading'),
          body: inlineRichtextLong('Body', options.richtextExtensions),
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
