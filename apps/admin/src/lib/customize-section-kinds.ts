import type { EditorGlyph } from '@commerce/ui/icons'
import { SECTION_ICONS } from './customize-puck'

/**
 * What kind of section a type is, for the small tinted tile its glyph sits on
 * in the Sections tree, the Add panel and the inspector header. Five kinds,
 * one tint each, all from theme tokens so dark mode follows:
 *
 * - `layout`: containers and page chrome (header, footer, columns, groups)
 * - `text`: words first (rich text, FAQ, testimonials, newsletter)
 * - `media`: pictures and video first (banners, galleries, logos)
 * - `product`: products and collections
 * - `app`: blocks installed apps contribute (their type is `<app-id>/<Name>`)
 *
 * Plain logic with no JSX, so it sits outside the component-structure rule.
 */
export type SectionKind = 'layout' | 'text' | 'media' | 'product' | 'app'

const KINDS: Record<string, SectionKind> = {
  Header: 'layout',
  Footer: 'layout',
  Multicolumn: 'layout',
  BentoGrid: 'layout',
  MainPage: 'text',
  MainBlog: 'text',
  MainArticle: 'text',
  MainSearch: 'layout',
  MainNotFound: 'layout',
  MainCart: 'product',
  MainProduct: 'product',
  MainCollection: 'product',
  RichText: 'text',
  AnnouncementBar: 'text',
  Testimonials: 'text',
  TestimonialMarquee: 'text',
  Faq: 'text',
  FaqAccordion: 'text',
  StatsCounter: 'text',
  BlogPosts: 'text',
  Newsletter: 'text',
  CtaBanner: 'text',
  Hero: 'media',
  ImageBanner: 'media',
  ImageWithText: 'media',
  SpotlightHero: 'media',
  SplitHero: 'media',
  VideoHero: 'media',
  Video: 'media',
  Gallery: 'media',
  LogoList: 'media',
  LogoMarquee: 'media',
  ProductGrid: 'product',
  FeaturedProducts: 'product',
  CollectionGrid: 'product',
  FeaturedProduct: 'product',
  CollectionList: 'product',
  RelatedProducts: 'product',
  RecentlyViewed: 'product',
  ShipsToday: 'product',
  CategoryPanels: 'product',
  FeaturedCarousel: 'product',
  ReviewsShowcase: 'text',
  PromoBento: 'media',
  LatestDrop: 'product',
  DropsTeaser: 'media',
  PerfectMatch: 'product',
  BrandLab: 'media',
  LogoCarousel: 'media',
  DropReveal: 'product',
  NotesSeries: 'text',
  SocialWall: 'media',
  DiscordCta: 'text',
  GridHero: 'media',
  RotatingHero: 'media',
  ShowcaseHero: 'media',
  LogoCloud: 'media',
  StatsCards: 'text',
  CtaCard: 'text',
  CtaSplit: 'media',
  FeatureCards: 'text',
  FeatureSteps: 'text',
  FeatureChecklist: 'media',
  TestimonialGrid: 'text',
  TestimonialSpotlight: 'text',
  FaqSplit: 'text',
  ComparisonTable: 'text',
  PricingCards: 'text',
  Lookbook: 'media',
  NewsletterBand: 'text',
  Timeline: 'text',
  TeamGrid: 'media',
  TrustBadges: 'text',
  Group: 'layout',
  Columns: 'layout',
  Grid: 'layout',
  Tabs: 'layout',
  Accordion: 'layout',
  Carousel: 'layout',
  Spacer: 'layout',
  Divider: 'layout',
  Heading: 'text',
  Text: 'text',
  Button: 'text',
  Badge: 'text',
  Icon: 'media',
  Image: 'media',
  VideoPlayer: 'media',
  ProductCard: 'product',
  CustomHtml: 'app',
}

/** An imported Shopify theme's sections are all `LiquidSection`; its file name says what each is. */
const IMPORTED = 'LiquidSection'

/**
 * Glyphs for an imported section, from words in its file name (`hero-carousel`,
 * `logo-carousel`, `reviews-showcase`), first match wins. Before this every imported section
 * showed the same page glyph in Layers.
 */
const IMPORTED_GLYPHS: [RegExp, EditorGlyph][] = [
  [/announcement|ticker/, 'megaphone'],
  [/footer/, 'footer'],
  [/header|dock|menu|nav/, 'header'],
  [/logo|brand|partner/, 'shapes'],
  [/review|testimonial|quote/, 'quote'],
  [/faq|accordion|collapsible/, 'accordion'],
  [/newsletter|signup|email|subscribe|popup/, 'send'],
  [/video/, 'video'],
  [/blog|article|notes|news|journal/, 'news'],
  [/gallery|social|instagram|lookbook/, 'gallery'],
  [/compar|before-after/, 'split'],
  [/tab/, 'tabs'],
  [/hero|slideshow|banner|carousel|slider/, 'carousel'],
  [/marquee|scroll/, 'marquee'],
  [/stat|counter|number/, 'stats'],
  [/bento|grid|panel|collection|category|list/, 'grid'],
  [/product|drop|ship|match|reveal|cart|shop/, 'package'],
  [/cta|discord|community|contact/, 'megaphone'],
  [/cookie|consent/, 'shapes'],
  [/image|picture|photo/, 'image'],
  [/text|story|about|content/, 'text'],
]

const GLYPH_KINDS: Partial<Record<EditorGlyph, SectionKind>> = {
  header: 'layout',
  footer: 'layout',
  tabs: 'layout',
  accordion: 'layout',
  shapes: 'media',
  gallery: 'media',
  video: 'media',
  carousel: 'media',
  marquee: 'media',
  image: 'media',
  split: 'media',
  grid: 'product',
  package: 'product',
}

/** An imported section's file name, the `handle` `sectionKind` and `sectionGlyph` take. */
export function sectionHandle(section: { props?: Record<string, unknown> }): string | undefined {
  const handle = section.props?.sectionType
  return typeof handle === 'string' ? handle : undefined
}

function importedGlyph(handle: string | undefined): EditorGlyph {
  const name = (handle ?? '').toLowerCase()
  return IMPORTED_GLYPHS.find(([words]) => words.test(name))?.[1] ?? 'page'
}

/**
 * The kind a section type belongs to; unknown types read as layout. `handle` is an imported
 * section's file name (`props.sectionType`), which decides for `LiquidSection`.
 */
export function sectionKind(type: string, handle?: string): SectionKind {
  if (type.includes('/')) return 'app'
  if (type === IMPORTED) return GLYPH_KINDS[importedGlyph(handle)] ?? 'text'
  return KINDS[type] ?? 'layout'
}

/**
 * Tile tint per kind: a 12% wash of a token colour with the glyph in the full
 * colour. Opacity on a token (not a separate "soft" swatch) keeps the same
 * contrast in light and dark, and follows the merchant's accent where it's used.
 */
export const KIND_TILE: Record<SectionKind, string> = {
  layout: 'bg-info/12 text-info',
  text: 'bg-muted-foreground/12 text-foreground/80',
  media: 'bg-chart-4/12 text-chart-4',
  product: 'bg-success/12 text-success',
  app: 'bg-chart-2/14 text-chart-2',
}

/** Glyphs for sections that don't carry an entry in `SECTION_ICONS` (main sections, groups). */
const EXTRA_GLYPHS: Record<string, EditorGlyph> = {
  Header: 'header',
  Footer: 'footer',
  MainProduct: 'package',
  MainCollection: 'grid',
  MainPage: 'page',
  MainBlog: 'news',
  MainArticle: 'news',
  MainCart: 'cart',
  MainSearch: 'search',
  MainNotFound: 'notFound',
  Group: 'group',
  Columns: 'columns',
  Grid: 'grid',
  Tabs: 'tabs',
  Accordion: 'accordion',
  Carousel: 'carousel',
  Heading: 'heading',
  Text: 'text',
  Image: 'image',
  Button: 'button',
  Icon: 'icon',
  VideoPlayer: 'video',
  Spacer: 'spacer',
  Divider: 'divider',
  Badge: 'badge',
  ProductCard: 'package',
  CustomHtml: 'code',
}

/** The glyph a section type shows, from the one editor glyph family (`handle`: see `sectionKind`). */
export function sectionGlyph(type: string, handle?: string): EditorGlyph {
  if (type === IMPORTED) return importedGlyph(handle)
  const extra = EXTRA_GLYPHS[type]
  if (extra) return extra
  if (type.includes('/')) return 'shapes'
  const key = SECTION_ICONS[type]
  return key && isGlyph(key) ? key : 'page'
}

const GLYPH_KEYS = new Set<string>([
  'header',
  'footer',
  'image',
  'megaphone',
  'text',
  'page',
  'columns',
  'quote',
  'list',
  'shapes',
  'grid',
  'package',
  'folder',
  'video',
  'news',
  'send',
  'spotlight',
  'split',
  'marquee',
  'stats',
  'gallery',
  'cart',
  'search',
  'notFound',
  'group',
  'tabs',
  'accordion',
  'carousel',
  'heading',
  'button',
  'icon',
  'spacer',
  'divider',
  'badge',
  'code',
] satisfies EditorGlyph[])

function isGlyph(key: string): key is EditorGlyph {
  return GLYPH_KEYS.has(key)
}
