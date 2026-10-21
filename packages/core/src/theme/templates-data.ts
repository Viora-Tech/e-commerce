/**
 * Theme templates, the browser-safe half: which templates a theme has, the
 * section data they hold, and the defaults a template falls back to before a
 * merchant edits it. A template is Puck data (`content` is its section list);
 * `header` and `footer` are the section groups every template shares.
 */

import { LIQUID_SECTION } from '../theme-import/fields'
import { defaultTemplatesContent } from './data/default-templates'
import { mapNestedBlocks, type StoredBlock } from './nested-blocks'

export const TEMPLATE_KINDS = [
  'home',
  'product',
  'collection',
  'page',
  'blog',
  'article',
  'cart',
  'search',
  'not_found',
] as const
export type TemplateKind = (typeof TEMPLATE_KINDS)[number]

export const SECTION_GROUPS = ['header', 'footer'] as const
export type SectionGroup = (typeof SECTION_GROUPS)[number]

/** A template row key: a page template or a section group. */
export type TemplateKey = TemplateKind | SectionGroup

export type TemplateSection = { type: string; props: { id: string } & Record<string, unknown> }

export type TemplateData = {
  root: { props?: Record<string, unknown> | undefined }
  content: TemplateSection[]
  zones?: Record<string, unknown> | undefined
}

/** Alternate template suffix, as in `product.preorder`. Blank is the default template. */
export const TEMPLATE_SUFFIX = /^[a-z0-9-]{0,40}$/

/** Kinds a resource can pick an alternate for (Shopify's "Theme template" select). */
export const ALTERNATE_KINDS = ['product', 'collection', 'page', 'blog', 'article'] as const
/** A template kind a resource can pick an alternate of (`product.preorder`). */
export type AlternateKind = (typeof ALTERNATE_KINDS)[number]
/** How many resources of each kind use each alternate, by suffix. Store-wide, not per theme. */
export type TemplateAssignments = Record<AlternateKind, Record<string, number>>

/**
 * The section each resource template is built around. It renders the resource
 * being viewed and cannot be removed or duplicated, only moved and configured.
 */
export const MAIN_SECTION: Partial<Record<TemplateKind, string>> = {
  product: 'MainProduct',
  collection: 'MainCollection',
  page: 'MainPage',
  blog: 'MainBlog',
  article: 'MainArticle',
  cart: 'MainCart',
  search: 'MainSearch',
  not_found: 'MainNotFound',
}

/** Sections that belong in a group rather than a template. */
export const GROUP_SECTIONS: Record<SectionGroup, readonly string[]> = {
  header: ['AnnouncementBar', 'Header'],
  footer: [
    'Footer',
    'Newsletter',
    'RichText',
    'Multicolumn',
    'LogoList',
    'MobileDock',
    'CookieBanner',
    'SignupPopup',
  ],
}

/**
 * Sections allowed only once on a template (the resource's main section, the groups'
 * anchors, and the cookie banner: there is one consent question, never two).
 */
export const SINGLE_SECTIONS = new Set([
  ...Object.values(MAIN_SECTION),
  'Header',
  'Footer',
  'CookieBanner',
])

const section = (type: string, id = type.toLowerCase()): TemplateSection => ({
  type,
  props: { id },
})

const data = (content: TemplateSection[]): TemplateData => ({
  root: { props: {} },
  content,
  zones: {},
})

/** A section with props set over its block's defaults. */
const withProps = (type: string, id: string, props: Record<string, unknown>): TemplateSection => ({
  type,
  props: { id, ...props },
})

const copy = defaultTemplatesContent

/**
 * Our generic sections only, with neutral copy set on each: several blocks' own defaults are
 * still the Zero Drift theme's (the Waimers store's own words and links), and a store's
 * stored `{ id }` rows rely on those, so the new-store copy lives here instead. Zero Drift
 * pack sections (phone dock, signup popups) are left out; a store adds them on opt-in.
 */
const HEADER_GROUP: TemplateSection[] = [
  withProps('AnnouncementBar', 'announcement-bar', {
    announcements: [{ text: copy.announcement, link: '' }],
    displayMode: 'rotate',
    showSocial: false,
    socials: [],
  }),
  // No curated menu cards: the theme's pointed at the Waimers quiz page.
  withProps('Header', 'header', { featureCards: [] }),
]

const FOOTER_GROUP: TemplateSection[] = [
  withProps('Newsletter', 'newsletter', { ...copy.newsletter, interests: [], reasons: [] }),
  withProps('Footer', 'footer', { ...copy.footer, helpCards: [], socials: [] }),
  section('CookieBanner', 'cookie-banner'),
]

const HOME: TemplateSection[] = [
  withProps('Hero', 'hero', {
    slides: [
      {
        kind: 'image',
        layout: 'full_bleed',
        heading: copy.hero.heading,
        subheading: copy.hero.subheading,
        image: { url: '', alt: '' },
        cta: { ...copy.hero.cta },
        textPosition: 'left',
        colorScheme: 'dark',
      },
    ],
  }),
  section('ProductGrid', 'product-grid'),
  withProps('RichText', 'rich-text', { ...copy.richText }),
]

/**
 * What a template renders before a merchant edits it. Resource templates are
 * just their main section, so a store without template rows looks exactly as it
 * did before templates existed.
 */
export function defaultTemplate(key: TemplateKey): TemplateData {
  // Fresh copies each call: callers store and edit what they get back.
  const fresh = (sections: TemplateSection[]) => data(structuredClone(sections))
  if (key === 'header') return fresh(HEADER_GROUP)
  if (key === 'footer') return fresh(FOOTER_GROUP)
  if (key === 'home') return fresh(HOME)
  const main = MAIN_SECTION[key]
  return data(main ? [section(main, 'main')] : [])
}

/**
 * A blank theme's template ("Start from scratch"): the header and footer groups hold only their
 * Header and Footer, the home page is empty, and every other template is just its main section,
 * which it needs to show the product, cart or page being viewed. Never the live theme's sections.
 */
export function blankTemplate(key: TemplateKey): TemplateData {
  const fresh = (sections: TemplateSection[]) => data(structuredClone(sections))
  if (key === 'header') return fresh(HEADER_GROUP.filter((s) => s.type === 'Header'))
  if (key === 'footer') return fresh(FOOTER_GROUP.filter((s) => s.type === 'Footer'))
  if (key === 'home') return data([])
  return defaultTemplate(key)
}

/**
 * The templates a blank theme stores a row for: only those whose blank differs from the code
 * default. A template with no row renders `defaultTemplate`, which for every other key already is
 * just its main section.
 */
export const BLANK_THEME_TEMPLATES = ['header', 'footer', 'home'] as const satisfies TemplateKey[]

/** Normalises anything stored in a template column into Puck data. */
export function parseTemplateData(value: unknown): TemplateData | null {
  if (typeof value !== 'object' || value === null) return null
  const content = (value as { content?: unknown }).content
  if (!Array.isArray(content)) return null
  const sections = content.filter(
    (s): s is TemplateSection =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as TemplateSection).type === 'string' &&
      typeof (s as TemplateSection).props?.id === 'string',
  )
  const root = (value as { root?: TemplateData['root'] }).root
  return { root: root && typeof root === 'object' ? root : { props: {} }, content: sections }
}

/** Hidden sections stay in the template (Shopify's eye toggle) but never render. */
export const isSectionHidden = (s: TemplateSection): boolean => s.props._hidden === true

/**
 * A stored template without an imported theme's own sections (`LiquidSection`), which render
 * only with that theme's Liquid files. A theme made from a preset keeps the live theme's
 * templates through this: our sections stay, the Shopify ones go, and a template left with
 * nothing to show is our default for its key. Anything without Liquid sections comes back as is.
 */
export function withoutLiquidSections(key: TemplateKey, value: unknown): unknown {
  const parsed = parseTemplateData(value)
  if (!parsed?.content.some((s) => s.type === LIQUID_SECTION)) return value
  const content = parsed.content.filter((s) => s.type !== LIQUID_SECTION)
  if (!content.some((s) => !isSectionHidden(s))) return defaultTemplate(key)
  return { ...(value as object), content }
}

/**
 * Sections a page shows at most, to keep it fast (Figma 698:92403). Hidden sections do not
 * count; the editor's Add panel stops offering sections at this many.
 */
export const MAX_VISIBLE_SECTIONS = 25

/** `product.preorder`, or just `product` for the default. */
export const templateName = (key: TemplateKey, suffix: string): string =>
  suffix ? `${key}.${suffix}` : key

export function isTemplateKey(value: string): value is TemplateKey {
  return (
    (TEMPLATE_KINDS as readonly string[]).includes(value) ||
    (SECTION_GROUPS as readonly string[]).includes(value)
  )
}

/**
 * Drops what blocks resolve at render time: `resolved` product lists inside
 * `props`, and the sibling `readOnly` key Puck's own `resolveData` runtime
 * attaches to the section once those props resolve (not part of our
 * `TemplateSection` type, so `content.map` carries it through unless it's
 * stripped explicitly here). Both come back the moment Puck resolves the
 * section again, so leaving either in would make freshly loaded, unedited
 * data compare unequal to itself — "Unsaved changes" lighting up on load.
 */
export function stripResolved(data: TemplateData): TemplateData {
  // Nested blocks (in slots) carry resolveData output too, such as a Product card's product.
  const strip = (block: StoredBlock): StoredBlock => {
    const { resolved: _resolved, ...props } = block.props
    const { readOnly: _readOnly, ...rest } = block as StoredBlock & { readOnly?: unknown }
    return { ...rest, props }
  }
  return {
    ...data,
    content: data.content.map((s) => mapNestedBlocks(s, strip) as TemplateSection),
  }
}

/** JSON with sorted keys, so two copies of the same template compare equal. */
export function stableTemplateJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )
}
