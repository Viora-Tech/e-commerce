import { SECTION_STYLES_CSS, SECTION_STYLES_VERSION } from './section-styles.generated'

/**
 * The blocks section styles only our own themes' sections use (hero carousel, drop reveal,
 * social wall, the section library...: `packages/blocks/src/styles/sections.css`), kept out of
 * the global stylesheet every page loads. Our own themes link it on every page (`-s/[storeId]/
 * layout.tsx`); an imported theme's page links it only when it shows one of our sections other
 * than the ones below (`renderTemplate`), so a Shopify theme's product page skips about 150 KB.
 *
 * Served by `app/api/section-styles/route.ts` from the module `bun run css:sections` builds.
 */

/** Sections an imported theme's pages show that draw only with the global stylesheet. */
const GLOBAL_STYLE_SECTIONS = new Set([
  'LiquidSection',
  'RecentlyViewed',
  'MainProduct',
  'MainCollection',
  'MainSearch',
  'MainPage',
  'MainAccount',
  'MainLogin',
  'MainNotFound',
  'MainCart',
  'MainBlog',
  'MainArticle',
])

/** Whether a page whose top-level sections are these types needs the section styles. */
export function needsSectionStyles(types: Iterable<string>): boolean {
  for (const type of types) if (!GLOBAL_STYLE_SECTIONS.has(type)) return true
  return false
}

/** The stylesheet's address; `?v=` is its content hash, so the file caches for a year. */
export function sectionStylesHref(): string {
  return `/api/section-styles?v=${SECTION_STYLES_VERSION}`
}

/** The file a `/api/section-styles` request gets, and whether it is the current version. */
export function sectionStylesFile(version: string | null): { css: string; current: boolean } {
  return { css: SECTION_STYLES_CSS, current: version === SECTION_STYLES_VERSION }
}
