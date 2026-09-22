import type { ComponentConfig, Fields } from '@measured/puck'
import type { ReactNode } from 'react'
import type { NewsletterAction } from '../components/sections/newsletter'
import { sectionsContent } from '../data/sections'

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
}

const yesNo = (label: string) =>
  ({
    type: 'radio',
    label,
    options: [
      { label: 'Show', value: true },
      { label: 'Hide', value: false },
    ],
  }) as const

type Def = { label: string; fields: Fields; defaultProps: SectionSettings }

const DEFS: Record<DynamicSection, Def> = {
  Header: {
    label: 'Header',
    fields: { menu: { type: 'text', label: 'Menu handle (blank uses Navigation)' } },
    defaultProps: { menu: '' },
  },
  Footer: {
    label: 'Footer',
    fields: { tagline: { type: 'textarea', label: 'Tagline' } },
    defaultProps: { tagline: sectionsContent.footer.tagline },
  },
  MainProduct: {
    label: 'Product information',
    fields: {
      showEmiHint: yesNo('EMI hint under the price'),
      showDeliveryEstimate: yesNo('Delivery estimate'),
    },
    defaultProps: { showEmiHint: true, showDeliveryEstimate: true },
  },
  MainCollection: {
    label: 'Product grid',
    fields: {
      showImage: yesNo('Collection image'),
      showDescription: yesNo('Collection description'),
      showSort: yesNo('Sorting'),
    },
    defaultProps: { showImage: false, showDescription: true, showSort: true },
  },
  MainPage: {
    label: 'Page',
    fields: { showTitle: yesNo('Page title') },
    defaultProps: { showTitle: true },
  },
  MainBlog: { label: 'Blog posts', fields: {}, defaultProps: {} },
  MainArticle: { label: 'Blog post', fields: {}, defaultProps: {} },
  MainCart: { label: 'Cart items', fields: {}, defaultProps: {} },
  MainSearch: { label: 'Search results', fields: {}, defaultProps: {} },
  MainNotFound: { label: 'Page not found', fields: {}, defaultProps: {} },
  RelatedProducts: {
    label: 'Related products',
    fields: {
      heading: { type: 'text', label: 'Heading' },
      limit: { type: 'number', label: 'Products', min: 2, max: 8 },
    },
    defaultProps: { heading: sectionsContent.related.heading, limit: 4 },
  },
  RecentlyViewed: {
    label: 'Recently viewed',
    fields: {
      heading: { type: 'text', label: 'Heading' },
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
