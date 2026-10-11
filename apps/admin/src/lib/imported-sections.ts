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
 * the same rule. A new section starts from the first preset: the schema's setting defaults,
 * then the preset's own settings and blocks.
 */

/** What the editor knows about the open imported theme (`themes.import.editor`). */
export type ImportedTheme = {
  schemas: Record<string, ShopifySectionSchema>
  blockSchemas: Record<string, ShopifySectionSchema>
  schemaLocale: Record<string, unknown>
}

/** One section the merchant can add. */
export type ImportedSection = {
  /** `sections/<type>.liquid`. */
  type: string
  /** The schema's name in the theme's own words, else the file name. */
  name: string
}

/** Sections with at least one preset, by name. */
export function importedSections(theme: ImportedTheme): ImportedSection[] {
  return Object.entries(theme.schemas)
    .filter(([, schema]) => (schema.presets?.length ?? 0) > 0)
    .map(([type, schema]) => ({
      type,
      name: schemaText(schema.name, theme.schemaLocale) || type,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
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
 * A new section from its first preset, ready to insert. `null` when the theme has no such
 * section or it has no preset.
 */
export function newImportedSection(theme: ImportedTheme, type: string): TemplateSection | null {
  const schema = theme.schemas[type]
  const preset = schema?.presets?.[0]
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
      _name: schemaText(schema.name, theme.schemaLocale) || type,
      blocks,
      ...settingsToProps(settings),
    },
  } as TemplateSection
}
