import type { ComponentConfig, Fields } from '@puckeditor/core'
import type { ReactNode } from 'react'
import EditorOverlay from '../components/editor-overlay'
import SectionCustomCss from '../components/section-custom-css'
import type { NewsletterAction } from '../components/sections/newsletter'
import { sectionsContent } from '../data/sections'
import {
  bleedFrameProps,
  defaultSectionSettings,
  isNeutralFlow,
  migrateSectionSettings,
  type SectionSettingsValue,
  type SettingsKind,
  sectionSettingsField,
} from '../section-settings'
import type { AddToCart } from '../store-actions'
import type { ProductDetail } from '../types'
import { SCHEMES } from './framed'
import { inlineText } from './inline-fields'
import { mainProductDefaults, mainProductFields, showHide as yesNo } from './main-product-settings'
import { cookieBannerDef } from './zero-drift/cookie-banner'
import { footerDef } from './zero-drift/footer'
import { headerDef } from './zero-drift/header'

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
  'MainAccount',
  'MainLogin',
  'RelatedProducts',
  'RecentlyViewed',
] as const
export type DynamicSection = (typeof DYNAMIC_SECTIONS)[number]

export type SectionSettings = Record<string, unknown>
export type SectionRenderer = (settings: SectionSettings) => ReactNode

/** What the storefront hands every rendered template. */
export type SectionMetadata = {
  /** `LiquidSection` draws an imported Shopify section (see `./liquid.tsx`). */
  renderers?: Partial<Record<DynamicSection | 'LiquidSection', SectionRenderer>> | undefined
  /**
   * Imported Shopify theme: editor fields per section type, generated from each
   * section's `{% schema %}`. Only Customize sets it.
   */
  liquid?: { fields: Record<string, Fields> } | undefined
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
  productActions?: { addToCart?: AddToCart | undefined } | undefined
}

type Def = { label: string; fields: Fields; defaultProps: SectionSettings }

/**
 * Which shared Section settings each dynamic section offers (`../section-settings.ts`).
 * - `flow`: spacing, colour scheme, show on mobile/desktop and the anchor, on a frame around
 *   what the storefront draws for the page.
 * - `bleed` (header and footer): the same without the colour scheme, which their own design
 *   sets (the footer is always the dark band).
 * - none: the cookie banner floats over the page, so spacing and schemes have nothing to act on.
 * Defaults change nothing, and an untouched section is drawn with no frame at all.
 */
const SETTINGS_KIND: Partial<Record<DynamicSection, Exclude<SettingsKind, 'section'>>> = {
  Header: 'bleed',
  Footer: 'bleed',
  MainProduct: 'flow',
  MainCollection: 'flow',
  MainPage: 'flow',
  MainBlog: 'flow',
  MainArticle: 'flow',
  MainCart: 'flow',
  MainSearch: 'flow',
  MainNotFound: 'flow',
  MainAccount: 'flow',
  MainLogin: 'flow',
  RelatedProducts: 'flow',
  RecentlyViewed: 'flow',
}

/** No padding and the default scheme: the look these sections had before settings. */
const FLOW_SETTINGS = defaultSectionSettings({ padTop: 0, padBottom: 0 })

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
  MainAccount: { label: 'Customer account', fields: {}, defaultProps: {} },
  MainLogin: { label: 'Sign in', fields: {}, defaultProps: {} },
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

/** Dynamic sections that float over the page on the store rather than sitting in its flow. */
const OVERLAY_SECTIONS: ReadonlySet<DynamicSection> = new Set(['CookieBanner'])

/** What the storefront drew, inside a frame only when a setting asks for one. */
function framedFlow(section: ReactNode, settings: SectionSettingsValue): ReactNode {
  if (section === null || isNeutralFlow(settings)) return section
  const frame = bleedFrameProps(settings)
  const scheme =
    settings.style.colorScheme !== 'scheme-1' ? ` color-${settings.style.colorScheme}` : ''
  return (
    <div
      {...frame}
      className={`section-frame${scheme}${frame.className ? ` ${frame.className}` : ''}`}
    >
      <SectionCustomCss css={settings.advanced.customCss} />
      {section}
    </div>
  )
}

function dynamicSection(type: DynamicSection): ComponentConfig<SectionSettings> {
  const def = DEFS[type]
  const kind = SETTINGS_KIND[type]
  return {
    label: def.label,
    fields: kind ? { ...def.fields, settings: sectionSettingsField(SCHEMES, kind) } : def.fields,
    defaultProps: kind ? { ...def.defaultProps, settings: FLOW_SETTINGS } : def.defaultProps,
    render: ({ puck, id, ...settings }) => {
      const meta = (puck?.metadata ?? {}) as SectionMetadata
      const drawn = meta.renderers?.[type]?.({ ...def.defaultProps, ...settings }) ?? null
      const section = kind
        ? framedFlow(drawn, migrateSectionSettings({ settings: settings.settings }, FLOW_SETTINGS))
        : drawn
      // Floats over the page on the store: a strip in the canvas until selected.
      if (puck?.isEditing && OVERLAY_SECTIONS.has(type)) {
        return (
          <EditorOverlay id={typeof id === 'string' ? id : undefined} label={def.label}>
            <div className="editor-overlay__float">{section}</div>
          </EditorOverlay>
        )
      }
      return <>{section}</>
    },
  }
}

export function dynamicSections(): Record<DynamicSection, ComponentConfig<SectionSettings>> {
  return Object.fromEntries(DYNAMIC_SECTIONS.map((t) => [t, dynamicSection(t)])) as Record<
    DynamicSection,
    ComponentConfig<SectionSettings>
  >
}
