/**
 * SOURCE OF TRUTH KEYWORDS: SECTION_CATEGORIES, sectionCategories, theme packs, add-section menu
 * WHAT:  The add-section menu's groups, and which of them one store sees: a theme pack's
 *        sections (Zero Drift) only once the store turned the pack on.
 * WHY:   Zero Drift is the Waimers store's own theme; other stores start on our generic groups.
 * WHERE: `./puck-config.tsx` builds Puck's categories from it; the admin Add panel lists it.
 */
import { ELEMENT_BLOCKS, LAYOUT_BLOCKS } from './sections/custom'
import { ZERO_DRIFT_SECTIONS } from './sections/zero-drift'
import { ZERO_DRIFT_PRODUCT_SECTIONS } from './sections/zero-drift-product'

/**
 * Every section the add-section menu can offer, in Shopify's order. Main sections and the
 * header and footer are placed by their template or group, never added from here. What one
 * store's menu shows is `sectionCategories(themePacks)`: a theme pack's sections only on opt-in.
 */
export const SECTION_CATEGORIES = {
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
      'SaleCountdown',
      'ProductLaunch',
      'OffersStrip',
      // The starter kit (`./sections/kit.tsx`).
      'GridHero',
      'RotatingHero',
      'ShowcaseHero',
      'CtaCard',
      'CtaSplit',
      'FeatureChecklist',
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
      'StatsCards',
      'FeatureCards',
      'FeatureSteps',
      'TestimonialGrid',
      'TestimonialSpotlight',
      'FaqSplit',
      'ComparisonTable',
      'PricingCards',
      'Timeline',
      'TeamGrid',
      'TrustBadges',
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
      // The Zero Drift theme's product-page sections; see ./sections/zero-drift-product.tsx.
      ...ZERO_DRIFT_PRODUCT_SECTIONS,
    ],
  },
  media: { title: 'Media', components: ['Video', 'Gallery', 'LogoCloud', 'Lookbook'] },
  more: {
    title: 'More',
    components: ['BlogPosts', 'Newsletter', 'NewsletterBand', 'StoreLocator'],
  },
  // Build your own: containers whose content is slots, and the elements that go in them.
  layout: { title: 'Layout', components: LAYOUT_BLOCKS },
  elements: { title: 'Elements', components: ELEMENT_BLOCKS },
  // Rebuilt from the Waimers store's own Shopify theme, Zero Drift (./sections/zero-drift.tsx).
  // A theme pack: offered only to stores that opt in (`sectionCategories`), after our own groups.
  zeroDrift: { title: 'Zero Drift theme', components: ZERO_DRIFT_SECTIONS },
} as const

/** The Zero Drift theme pack's id, as stored in `store.apps.settings.core.themePacks`. */
export const ZERO_DRIFT_PACK = 'zero-drift'

/** Sections that belong to an opt-in theme pack, by pack id. */
export const THEME_PACK_SECTIONS: Record<string, readonly string[]> = {
  [ZERO_DRIFT_PACK]: [...ZERO_DRIFT_SECTIONS, ...ZERO_DRIFT_PRODUCT_SECTIONS],
}

/** The group each pack brings; a store without the pack never sees it. */
const PACK_CATEGORIES: Record<string, string> = { [ZERO_DRIFT_PACK]: 'zeroDrift' }

const packsOff = (themePacks: readonly string[]) =>
  Object.keys(THEME_PACK_SECTIONS).filter((id) => !themePacks.includes(id))

/**
 * Section types the store cannot add: every section of a theme pack it has not turned on. The
 * header and footer groups' lists filter by it too (the Zero Drift phone dock and popups).
 */
export function hiddenPackSections(themePacks: readonly string[] = []): ReadonlySet<string> {
  return new Set(packsOff(themePacks).flatMap((id) => THEME_PACK_SECTIONS[id] ?? []))
}

export type SectionCategoryId = keyof typeof SECTION_CATEGORIES
export type SectionCategory = { title: string; components: string[] }

/**
 * The add-section menu for one store: `SECTION_CATEGORIES` in order, less every section of a
 * theme pack the store has not turned on (and that pack's own group). Saved pages that already
 * use those sections keep rendering; this only decides what can be added.
 */
export function sectionCategories(
  themePacks: readonly string[] = [],
): Partial<Record<SectionCategoryId, SectionCategory>> {
  const off = packsOff(themePacks)
  const hidden = hiddenPackSections(themePacks)
  const hiddenGroups = new Set(off.flatMap((id) => PACK_CATEGORIES[id] ?? []))
  return Object.fromEntries(
    Object.entries(SECTION_CATEGORIES)
      .filter(([id]) => !hiddenGroups.has(id))
      .map(([id, c]) => [
        id,
        {
          title: c.title,
          components: (c.components as readonly string[]).filter((t) => !hidden.has(t)),
        },
      ]),
  )
}
