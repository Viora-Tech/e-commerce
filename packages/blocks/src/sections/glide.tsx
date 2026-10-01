import type { ComponentConfig } from '@puckeditor/core'
import { type BrandLabProps, brandLabSection } from './glide/brand-lab'
import { type CategoryPanelsProps, categoryPanelsSection } from './glide/category-panels'
import { type DiscordCtaProps, discordCtaSection } from './glide/discord-cta'
import { type DropRevealProps, dropRevealSection } from './glide/drop-reveal'
import { type DropsTeaserProps, dropsTeaserSection } from './glide/drops-teaser'
import { type FeaturedCarouselProps, featuredCarouselSection } from './glide/featured-carousel'
import { type ImageComparisonProps, imageComparisonSection } from './glide/image-comparison'
import { type LatestDropProps, latestDropSection } from './glide/latest-drop'
import type { GlideLoaders } from './glide/loaders'
import { type LogoCarouselProps, logoCarouselSection } from './glide/logo-carousel'
import { type MobileDockProps, mobileDockSection } from './glide/mobile-dock'
import { type NotesSeriesProps, notesSeriesSection } from './glide/notes-series'
import { type PerfectMatchProps, perfectMatchSection } from './glide/perfect-match'
import { type PromoBentoProps, promoBentoSection } from './glide/promo-bento'
import { type ReviewsProps, reviewsSection } from './glide/reviews'
import { type ReviewsShowcaseProps, reviewsShowcaseSection } from './glide/reviews-showcase'
import { type ShipsTodayProps, shipsTodaySection } from './glide/ships-today'
import { type SignupPopupProps, signupPopupSection } from './glide/signup-popup'
import { type SocialWallProps, socialWallSection } from './glide/social-wall'

/**
 * SOURCE OF TRUTH KEYWORDS: glideSections, GlideProps, GLIDE_SECTIONS, Glide theme port
 * WHAT:  The registry of sections rebuilt from our own Shopify theme (Glide), one entry per
 *        `sections/<name>.liquid`, in the home page's order.
 * WHY:   Each section's config lives beside it in `./glide/<name>.tsx` (fields, defaults from
 *        the theme's `templates/index.json`, loaders); this file only lists them, so
 *        `createBlocksConfig` and the tests derive the set from one place. Inventory and
 *        status of every theme section: `docs/design/glide-theme-port.md`.
 * WHERE: `../puck-config.tsx` registers and categorises them; components in
 *        `../components/sections/glide/`, styles in `../styles/section-<name>.css`.
 */
export type GlideProps = {
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

const BUILDERS: { [K in keyof GlideProps]: (loaders: GlideLoaders) => ComponentConfig } = {
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
export const GLIDE_SECTIONS = Object.keys(BUILDERS) as (keyof GlideProps)[]

export type { GlideLoaders } from './glide/loaders'

export function glideSections(loaders: GlideLoaders): Record<keyof GlideProps, ComponentConfig> {
  return Object.fromEntries(GLIDE_SECTIONS.map((k) => [k, BUILDERS[k](loaders)])) as Record<
    keyof GlideProps,
    ComponentConfig
  >
}
