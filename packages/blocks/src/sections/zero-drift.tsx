import type { ComponentConfig } from '@puckeditor/core'
import { type BrandLabProps, brandLabSection } from './zero-drift/brand-lab'
import { type CategoryPanelsProps, categoryPanelsSection } from './zero-drift/category-panels'
import { type DiscordCtaProps, discordCtaSection } from './zero-drift/discord-cta'
import { type DropRevealProps, dropRevealSection } from './zero-drift/drop-reveal'
import { type DropsTeaserProps, dropsTeaserSection } from './zero-drift/drops-teaser'
import { type FeaturedCarouselProps, featuredCarouselSection } from './zero-drift/featured-carousel'
import { type ImageComparisonProps, imageComparisonSection } from './zero-drift/image-comparison'
import { type LatestDropProps, latestDropSection } from './zero-drift/latest-drop'
import type { ZeroDriftLoaders } from './zero-drift/loaders'
import { type LogoCarouselProps, logoCarouselSection } from './zero-drift/logo-carousel'
import { type MobileDockProps, mobileDockSection } from './zero-drift/mobile-dock'
import { type NotesSeriesProps, notesSeriesSection } from './zero-drift/notes-series'
import { type PerfectMatchProps, perfectMatchSection } from './zero-drift/perfect-match'
import { type PromoBentoProps, promoBentoSection } from './zero-drift/promo-bento'
import { type ReviewsProps, reviewsSection } from './zero-drift/reviews'
import { type ReviewsShowcaseProps, reviewsShowcaseSection } from './zero-drift/reviews-showcase'
import { type ShipsTodayProps, shipsTodaySection } from './zero-drift/ships-today'
import { type SignupPopupProps, signupPopupSection } from './zero-drift/signup-popup'
import { type SocialWallProps, socialWallSection } from './zero-drift/social-wall'

/**
 * SOURCE OF TRUTH KEYWORDS: zeroDriftSections, ZeroDriftProps, ZERO_DRIFT_SECTIONS, Glide theme port
 * WHAT:  The registry of sections rebuilt from our own Shopify theme (Glide), one entry per
 *        `sections/<name>.liquid`, in the home page's order.
 * WHY:   Each section's config lives beside it in `./zero-drift/<name>.tsx` (fields, defaults from
 *        the theme's `templates/index.json`, loaders); this file only lists them, so
 *        `createBlocksConfig` and the tests derive the set from one place. Inventory and
 *        status of every theme section: `docs/design/glide-theme-port.md`.
 * WHERE: `../puck-config.tsx` registers and categorises them; components in
 *        `../components/sections/zero-drift/`, styles in `../styles/section-<name>.css`.
 */
export type ZeroDriftProps = {
  ShipsToday: ShipsTodayProps
  CategoryPanels: CategoryPanelsProps
  FeaturedCarousel: FeaturedCarouselProps
  ReviewsShowcase: ReviewsShowcaseProps
  PromoBento: PromoBentoProps
  LatestDrop: LatestDropProps
  DropsTeaser: DropsTeaserProps
  PerfectMatch: PerfectMatchProps
  BrandLab: BrandLabProps
  LogoCarousel: LogoCarouselProps
  DropReveal: DropRevealProps
  NotesSeries: NotesSeriesProps
  SocialWall: SocialWallProps
  DiscordCta: DiscordCtaProps
  Reviews: ReviewsProps
  ImageComparison: ImageComparisonProps
  MobileDock: MobileDockProps
  SignupPopup: SignupPopupProps
}

const BUILDERS: { [K in keyof ZeroDriftProps]: (loaders: ZeroDriftLoaders) => ComponentConfig } = {
  ShipsToday: shipsTodaySection,
  CategoryPanels: categoryPanelsSection,
  FeaturedCarousel: featuredCarouselSection,
  ReviewsShowcase: reviewsShowcaseSection,
  PromoBento: promoBentoSection,
  LatestDrop: latestDropSection,
  DropsTeaser: dropsTeaserSection,
  PerfectMatch: perfectMatchSection,
  BrandLab: brandLabSection,
  LogoCarousel: logoCarouselSection,
  DropReveal: dropRevealSection,
  NotesSeries: notesSeriesSection,
  SocialWall: socialWallSection,
  DiscordCta: discordCtaSection,
  Reviews: reviewsSection,
  ImageComparison: imageComparisonSection,
  MobileDock: mobileDockSection,
  SignupPopup: signupPopupSection,
}

/** Every Glide section key, in the theme home page's order. */
export const ZERO_DRIFT_SECTIONS = Object.keys(BUILDERS) as (keyof ZeroDriftProps)[]

export type { ZeroDriftLoaders } from './zero-drift/loaders'

export function zeroDriftSections(
  loaders: ZeroDriftLoaders,
): Record<keyof ZeroDriftProps, ComponentConfig> {
  return Object.fromEntries(ZERO_DRIFT_SECTIONS.map((k) => [k, BUILDERS[k](loaders)])) as Record<
    keyof ZeroDriftProps,
    ComponentConfig
  >
}
