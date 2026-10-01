import type { ComponentConfig, Fields } from '@puckeditor/core'
import type { ReactNode } from 'react'
import type { NewsletterAction } from '../components/sections/newsletter'
import { sectionsContent } from '../data/sections'
import type { ProductDetail } from '../types'
import { cookieBannerDef } from './glide/cookie-banner'
import { footerDef } from './glide/footer'
import { headerDef } from './glide/header'
import { inlineText } from './inline-fields'
import { mainProductDefaults, mainProductFields, showHide as yesNo } from './main-product-settings'

/**
 * Sections bound to what the shopper is looking at: the header and footer (store
 * menus, cart count), and each template's main section (the product, collection,
 * page, post or cart). Blocks cannot load those on their own, so the storefront
 * passes a renderer per section through Puck metadata and the section only
 * carries its settings.
 */
export const DYNAMIC_SECTIONS = [
  'Header',
  'Footer',
  'CookieBanner',
  'MainProduct',
  'MainCollection',
  'MainPage',
  'MainBlog',
  'MainArticle',
  'MainCart',
  'MainSearch',
  'MainNotFound',
  'RelatedProducts',
  'RecentlyViewed',
] as const
export type DynamicSection = (typeof DYNAMIC_SECTIONS)[number]

export type SectionSettings = Record<string, unknown>
export type SectionRenderer = (settings: SectionSettings) => ReactNode

/** What the storefront hands every rendered template. */
export type SectionMetadata = {
  renderers?: Partial<Record<DynamicSection, SectionRenderer>> | undefined
  newsletterAction?: NewsletterAction | undefined
  /**
   * Data and bound actions app blocks need beyond their own settings (the
   * product on a product page, a server action bound to the store) — the
   * same "storefront hands it through metadata" pattern as `renderers`. Read
   * defensively: a block may be placed on a template that never sets the key
   * it wants, e.g. "Notify me" added outside a product page.
   */
  appBlockContext?: Record<string, unknown> | undefined
  /**
   * The product being viewed, on a product template (the storefront product route, or
   * the Customize canvas previewing a product). Product sections (tabs, specs, size
   * guide...) read it; without one they render nothing, or a hint in the editor.
   */
  product?: ProductDetail | undefined
  /**
   * Actions on `product` the storefront binds for product sections: the sticky add-to-cart
   * bar adds the selected variant with `addToCart`. Unset in the Customize canvas, where
   * those buttons stay inert.
   */
  productActions?:
    | { addToCart?: ((variantId: string, quantity: number) => Promise<void>) | undefined }
    | undefined
}

type Def = { label: string; fields: Fields; defaultProps: SectionSettings }

const DEFS: Record<DynamicSection, Def> = {
  Header: headerDef,
  Footer: footerDef,
  CookieBanner: cookieBannerDef,
  MainProduct: {
    label: 'Product information',
    // Gallery and buy box settings: ./main-product-settings.ts (old docs saved only the
    // first two, showEmiHint and showDeliveryEstimate; the rest read as their defaults).
    fields: mainProductFields,
    defaultProps: mainProductDefaults(),
  },
  MainCollection: {
    label: 'Product grid',
    fields: {
      showImage: yesNo('Collection image'),
      showDescription: yesNo('Collection description'),
      showFilters: yesNo('Filtering'),
      showSort: yesNo('Sorting'),
    },
    defaultProps: { showImage: false, showDescription: true, showFilters: true, showSort: true },
  },
  MainPage: {
    label: 'Page',
    fields: { showTitle: yesNo('Page title') },
    defaultProps: { showTitle: true },
  },
  MainBlog: { label: 'Blog posts', fields: {}, defaultProps: {} },
  MainArticle: { label: 'Blog post', fields: {}, defaultProps: {} },
  MainCart: { label: 'Cart items', fields: {}, defaultProps: {} },
  MainSearch: {
    label: 'Search results',
    fields: { showFilters: yesNo('Filtering'), showSort: yesNo('Sorting') },
    defaultProps: { showFilters: true, showSort: true },
  },
  MainNotFound: { label: 'Page not found', fields: {}, defaultProps: {} },
  RelatedProducts: {
    label: 'Related products',
    fields: {
      heading: inlineText('Heading'),
      limit: { type: 'number', label: 'Products', min: 2, max: 8 },
    },
    defaultProps: { heading: sectionsContent.related.heading, limit: 4 },
  },
  RecentlyViewed: {
    label: 'Recently viewed',
    fields: {
      heading: inlineText('Heading'),
      limit: { type: 'number', label: 'Products', min: 2, max: 8 },
    },
    defaultProps: { heading: sectionsContent.recentlyViewed.heading, limit: 4 },
  },
}

function dynamicSection(type: DynamicSection): ComponentConfig<SectionSettings> {
  const def = DEFS[type]
  return {
    label: def.label,
    fields: def.fields,
    defaultProps: def.defaultProps,
    render: ({ puck, id: _id, ...settings }) => {
      const meta = (puck?.metadata ?? {}) as SectionMetadata
      return <>{meta.renderers?.[type]?.({ ...def.defaultProps, ...settings }) ?? null}</>
    },
  }
}

export function dynamicSections(): Record<DynamicSection, ComponentConfig<SectionSettings>> {
  return Object.fromEntries(DYNAMIC_SECTIONS.map((t) => [t, dynamicSection(t)])) as Record<
    DynamicSection,
    ComponentConfig<SectionSettings>
  >
}
