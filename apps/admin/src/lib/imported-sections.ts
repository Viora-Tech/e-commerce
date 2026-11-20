import type { TemplateSection } from '@commerce/core/theme'
import {
  LIQUID_SECTION,
  type LiquidBlockItem,
  liquidSectionId,
  type ShopifySectionSchema,
  type ShopifySetting,
  schemaText,
  settingDefaults,
  settingsToProps,
} from '@commerce/core/theme-import'

/**
 * The sections of the store's imported Shopify theme, as the Add panel offers them. Plain logic
 * with no JSX, so it sits outside the component-structure rule.
 *
 * Shopify only lets a merchant add a section that has a preset in its `{% schema %}`; the rest
 * (header, footer, the theme's main product section) are placed by the theme itself. We follow
 * the same rules: each preset is its own entry, `enabled_on` / `disabled_on` decide which
 * templates and groups take a section, and `limit` caps how many one holds. A new section starts
 * from its preset: the schema's setting defaults, then the preset's own settings and blocks.
 */

/** What the editor knows about the open imported theme (`themes.import.editor`). */
export type ImportedTheme = {
  schemas: Record<string, ShopifySectionSchema>
  blockSchemas: Record<string, ShopifySectionSchema>
  schemaLocale: Record<string, unknown>
}

/** One section the merchant can add: a section with one of its presets (Shopify lists each). */
export type ImportedSection = {
  /** `sections/<type>.liquid`. */
  type: string
  /** Which of the schema's presets this entry starts from. */
  preset: number
  /** The preset's name in the theme's own words, else the schema's, else the file name. */
  name: string
}

/** Where a section is being added: a template (Shopify's name: `index`, `product`…) or a group. */
export type ImportedPlace = { template: string } | { group: string }

/** Our template kinds under Shopify's template names, for `enabled_on` / `disabled_on`. */
const SHOPIFY_TEMPLATE: Record<string, string> = {
  home: 'index',
  not_found: '404',
  account: 'customers/account',
  login: 'customers/login',
}

export const shopifyTemplateName = (kind: string): string => SHOPIFY_TEMPLATE[kind] ?? kind

/** Whether a `{ templates, groups }` rule names this place (or `*`). */
function names(rule: unknown, place: ImportedPlace): boolean {
  if (!rule || typeof rule !== 'object') return false
  const [key, name] = 'group' in place ? ['groups', place.group] : ['templates', place.template]
  const list = (rule as Record<string, unknown>)[key]
  return Array.isArray(list) && list.some((entry) => entry === '*' || entry === name)
}

/**
 * Shopify's placement rules: with `enabled_on` a section goes only where it names, with
 * `disabled_on` anywhere but there, with neither anywhere.
 */
export function allowedIn(schema: ShopifySectionSchema, place: ImportedPlace): boolean {
  if (schema.enabled_on) return names(schema.enabled_on, place)
  if (schema.disabled_on) return !names(schema.disabled_on, place)
  return true
}

type SectionsWhere = {
  place?: ImportedPlace | undefined
  /** How many of each section type the template or group holds, for the schema's `limit`. */
  counts?: ReadonlyMap<string, number> | undefined
}

/**
 * Every preset of every section the place takes, by name: a section with no preset, one its
 * `enabled_on` / `disabled_on` keeps out of the place, or one already there `limit` times is
 * left out, as Shopify's Add section does.
 */
export function importedSections(
  theme: ImportedTheme,
  where: SectionsWhere = {},
): ImportedSection[] {
  const { place, counts } = where
  return Object.entries(theme.schemas)
    .filter(([type, schema]) => {
      if (place && !allowedIn(schema, place)) return false
      return schema.limit === undefined || (counts?.get(type) ?? 0) < schema.limit
    })
    .flatMap(([type, schema]) => {
      const section = schemaText(schema.name, theme.schemaLocale) || type
      return (schema.presets ?? []).map((preset, i) => ({
        type,
        preset: i,
        name: schemaText(preset.name, theme.schemaLocale) || section,
      }))
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** How many imported sections of each type a list of sections holds. */
export function sectionTypeCounts(sections: readonly TemplateSection[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const s of sections) {
    const type = s.type === LIQUID_SECTION ? s.props.sectionType : null
    if (typeof type === 'string') out.set(type, (out.get(type) ?? 0) + 1)
  }
  return out
}

/** A section matches on its name or its file name. */
export function matchesImported(section: ImportedSection, needle: string): boolean {
  if (!needle) return true
  return section.name.toLowerCase().includes(needle) || section.type.toLowerCase().includes(needle)
}

type PresetBlock = { type?: unknown; settings?: unknown }

/** A preset's blocks: the older array form, or the newer `{ id: block }` map with `block_order`. */
function presetBlockList(blocks: unknown, order: unknown): PresetBlock[] {
  if (Array.isArray(blocks)) return blocks as PresetBlock[]
  if (!blocks || typeof blocks !== 'object') return []
  const map = blocks as Record<string, PresetBlock>
  const ids = Array.isArray(order) ? (order as string[]) : Object.keys(map)
  return ids.flatMap((id) => (map[id] ? [map[id]] : []))
}

const asSettings = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

/**
 * A new section from one of its presets (the first by default), ready to insert. `null` when
 * the theme has no such section or no such preset.
 */
export function newImportedSection(
  theme: ImportedTheme,
  type: string,
  presetIndex = 0,
): TemplateSection | null {
  const schema = theme.schemas[type]
  const preset = schema?.presets?.[presetIndex]
  if (!schema || !preset) return null
  const blocks: LiquidBlockItem[] = presetBlockList(
    preset.blocks,
    (preset as { block_order?: unknown }).block_order,
  ).flatMap((b, i) => {
    if (typeof b.type !== 'string') return []
    const blockType = b.type
    const settings: ShopifySetting[] | undefined =
      schema.blocks?.find((x) => x.type === blockType)?.settings ??
      theme.blockSchemas[blockType]?.settings
    return [
      {
        id: `${blockType}-${i + 1}`,
        type: blockType,
        settings: { ...settingDefaults(settings), ...asSettings(b.settings) },
      },
    ]
  })
  const settings = { ...settingDefaults(schema.settings), ...asSettings(preset.settings) }
  return {
    type: LIQUID_SECTION,
    props: {
      id: liquidSectionId(type),
      sectionType: type,
      sectionKey: type,
      _name:
        schemaText(preset.name, theme.schemaLocale) ||
        schemaText(schema.name, theme.schemaLocale) ||
        type,
      blocks,
      ...settingsToProps(settings),
    },
  } as TemplateSection
}
