/** SOURCE OF TRUTH: the theme's collection sections → our MainCollection settings — WHAT: reads an imported theme's main collection section(s) (Zero Drift's `main-collection`, Dawn's `main-collection-banner` + `main-collection-product-grid`) and its theme settings into the `MainCollection` section's settings: columns per row (desktop and phone), description, image, filtering, sorting, breadcrumbs, capital titles, and the sections themselves so the grid can draw the theme's own product card / WHY: on import our MainCollection replaces the theme's main collection sections; without this the page opened with our defaults (#1048) */

import { mainProductProps } from './main-product-props'
import { isMainSection } from './report'
import type { ShopifyJsonTemplate, ShopifyTemplateSection } from './schema'
import type { ThemeCardSection } from './theme-cards'
import type { ThemeLook } from './theme-look'

type Props = Record<string, unknown>

/** A section's saved values as the import stores them (images pointed at Files...). */
type StoredSettings = (type: string, values: Record<string, unknown> | undefined) => Props

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/** The first of `ids` any section sets, in the template's order. */
function first(sections: ThemeCardSection[], ids: string[]): unknown {
  for (const s of sections) {
    for (const id of ids) if (s.settings[id] !== undefined) return s.settings[id]
  }
  return undefined
}

/** A yes/no setting under any of `ids` into `out[key]`; left out when no section sets it. */
function flag(out: Props, key: string, sections: ThemeCardSection[], ids: string[]) {
  const v = first(sections, ids)
  if (typeof v === 'boolean') out[key] = v
}

/** The template's enabled main sections in order: Dawn splits the page in two (banner, grid). */
function mainSections(tpl: ShopifyJsonTemplate, stored: StoredSettings): ThemeCardSection[] {
  return tpl.order.flatMap((key) => {
    const s = tpl.sections[key]
    if (!s || s.disabled || !isMainSection(s.type)) return []
    return [{ type: s.type, key, settings: stored(s.type, s.settings) }]
  })
}

/**
 * `MainCollection` settings for a theme's collection template (its main sections' settings,
 * stored as the import stores them) and its theme settings. Anything the theme does not set
 * keeps our default.
 */
function mainCollectionProps(
  tpl: ShopifyJsonTemplate,
  stored: StoredSettings,
  theme: { look: ThemeLook; settings: Record<string, unknown> },
): Props {
  const sections = mainSections(tpl, stored)
  const themeSettings = theme.settings
  const look = theme.look
  const out: Props = { _themeSections: sections }
  const desktop = num(first(sections, ['columns_desktop', 'products_per_row']))
  if (desktop !== null) out.columns = Math.min(6, Math.max(1, Math.round(desktop)))
  const phone = num(first(sections, ['columns_mobile']))
  if (phone !== null) out.columnsMobile = phone >= 2 ? 2 : 1
  flag(out, 'showDescription', sections, ['show_description', 'show_collection_description'])
  flag(out, 'showImage', sections, ['show_collection_image', 'show_image'])
  flag(out, 'showFilters', sections, ['enable_filtering', 'show_filters'])
  flag(out, 'showSort', sections, ['enable_sorting', 'show_sort'])
  if (typeof themeSettings.show_breadcrumbs === 'boolean')
    out.showBreadcrumbs = themeSettings.show_breadcrumbs
  if (look.uppercaseTitles) out.uppercaseTitle = true
  return out
}

/**
 * Our main section's opening settings for a theme's main section `s` in template `key`: the
 * product page's buy box (`./main-product-props.ts`), the collection page's grid (above).
 */
export function themeMainProps(
  key: string,
  tpl: ShopifyJsonTemplate,
  s: ShopifyTemplateSection,
  stored: StoredSettings,
  theme: { look: ThemeLook; settings: Record<string, unknown> },
): Props {
  if (key === 'product') return mainProductProps(s, theme.look)
  if (key === 'collection') return mainCollectionProps(tpl, stored, theme)
  return {}
}
