/** SOURCE OF TRUTH: imported sections as Puck data and editor fields — WHAT: how a Shopify section (settings, blocks) is stored in a theme template as a `LiquidSection` (prop keys, block items), how it reads back for the Liquid engine, and the editor fields generated from its `{% schema %}` / WHY: the importer writes this shape, the storefront and the canvas render from it, and Customize edits it; all three must agree. Browser safe */
import type { ShopifySectionSchema, ShopifySetting } from './schema'
import { isValueSetting } from './schema'

/** The Puck component every imported section is stored as. */
export const LIQUID_SECTION = 'LiquidSection'

/** Props a `LiquidSection` keeps for itself; a theme setting with one of these ids is prefixed. */
const RESERVED = new Set([
  'id',
  'puck',
  'editMode',
  'sectionType',
  'sectionKey',
  '_name',
  'blocks',
  'resolved',
  '_hidden',
  '_aboveFold',
])

/** The prop a theme setting is stored under. */
const settingPropKey = (id: string): string => (RESERVED.has(id) ? `setting_${id}` : id)

/** One block, as an item of the section's `blocks` array. */
export type LiquidBlockItem = {
  id: string
  type: string
  disabled?: boolean | undefined
  settings: Record<string, unknown>
}

/** A `LiquidSection`'s props. Theme settings sit at the top level beside these. */
export type LiquidSectionProps = {
  id: string
  /** `sections/<sectionType>.liquid`. */
  sectionType: string
  /** The key the theme's JSON template gave it (`hero`, `featured_xYz`): Shopify's `section.id`. */
  sectionKey: string
  /** The schema's name, shown in the editor's section list (Customize's rename). */
  _name?: string | undefined
  blocks: LiquidBlockItem[]
} & Record<string, unknown>

/** A section's own settings out of its props (by schema, so unknown props are left behind). */
export function settingsFromProps(
  props: Record<string, unknown>,
  schema: ShopifySectionSchema | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const s of schema?.settings ?? []) {
    if (!isValueSetting(s)) continue
    const key = settingPropKey(s.id)
    if (key in props) out[s.id] = props[key]
  }
  return out
}

/** Settings as props: the inverse of `settingsFromProps`. */
export function settingsToProps(settings: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(settings).map(([k, v]) => [settingPropKey(k), v]))
}

/** Blocks out of props, defensively (saved data is data). */
export function blocksFromProps(props: Record<string, unknown>): LiquidBlockItem[] {
  const raw = props.blocks
  if (!Array.isArray(raw)) return []
  return raw.flatMap((b, i) => {
    if (!b || typeof b !== 'object') return []
    const item = b as Partial<LiquidBlockItem>
    if (typeof item.type !== 'string') return []
    return [
      {
        id: typeof item.id === 'string' && item.id ? item.id : `block_${i}`,
        type: item.type,
        disabled: item.disabled === true,
        settings: item.settings && typeof item.settings === 'object' ? item.settings : {},
      },
    ]
  })
}

/** What the Liquid engine renders for one placed section (see `render.ts`, `LiquidSectionInput`). */
export type LiquidSectionPlacement = {
  id: string
  type: string
  settings: Record<string, unknown>
  blocks: LiquidBlockItem[]
  location: string
  index: number
}

/** A stable 14-digit number per template or group, standing in for Shopify's internal ids. */
function locationNumber(location: string): string {
  let h = 2166136261
  for (const ch of location) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return String(29_000_000_000_000 + (h % 1_000_000_000_000))
}

/**
 * Shopify's `section.id` for a section placed by a JSON template or group:
 * `template--<n>__hero`, `sections--<n>__header`. Themes key CSS on it
 * (`[id$="__category_panels"]`), so the shape matters, not the number.
 */
export function shopifySectionId(key: string, location: string): string {
  const prefix = location === 'template' ? 'template' : 'sections'
  return `${prefix}--${locationNumber(location)}__${key}`
}

/** A `LiquidSection`'s props as the engine's input; `location` is `template` or a group name. */
export function liquidPlacement(
  props: Record<string, unknown>,
  schema: ShopifySectionSchema | null | undefined,
  location: string,
  index: number,
): LiquidSectionPlacement {
  return {
    id: shopifySectionId(liquidSectionKey(props), location),
    type: typeof props.sectionType === 'string' ? props.sectionType : '',
    settings: settingsFromProps(props, schema),
    blocks: blocksFromProps(props),
    location,
    index,
  }
}

/** A Puck props id for a section key: `LiquidSection-hero`, at most 80 characters. */
export function liquidSectionId(key: string): string {
  const clean = key.replace(/[^A-Za-z0-9_-]/g, '-')
  const id = `${LIQUID_SECTION}-${clean}`
  return id.length <= 80 ? id : `${id.slice(0, 71)}-${clean.length.toString(36)}${clean.slice(-4)}`
}

/**
 * Shopify's `section.id` for a placed section: the theme's own key while the section
 * still has the id the import gave it, otherwise (a copy made in Customize) one
 * derived from its Puck id, so two copies never share element ids.
 */
export function liquidSectionKey(props: { id?: unknown; sectionKey?: unknown }): string {
  const key = typeof props.sectionKey === 'string' ? props.sectionKey : ''
  const id = typeof props.id === 'string' ? props.id : ''
  if (key && id === liquidSectionId(key)) return key
  const derived = id.replace(`${LIQUID_SECTION}-`, '').replace(/[^A-Za-z0-9_-]/g, '')
  return derived.slice(-40) || key || 'section'
}

/** `t:sections.hero.name` labels resolve through the theme's schema locale. */
export function schemaText(value: string | undefined, locale: Record<string, unknown>): string {
  if (!value) return ''
  if (!value.startsWith('t:')) return value
  let node: unknown = locale
  for (const part of value.slice(2).split('.')) {
    if (typeof node !== 'object' || node === null) return value.slice(2)
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : (value.slice(2).split('.').pop() ?? value)
}

/**
 * Editor fields, in Puck's field vocabulary but kept as plain data here (the blocks
 * package casts them to Puck's `Fields`). Images use the `{ url, alt }` object the
 * Customize image picker edits.
 */
export type LiquidField =
  | { type: 'text' | 'textarea'; label: string; placeholder?: string | undefined }
  | {
      type: 'number'
      label: string
      min?: number | undefined
      max?: number | undefined
      step?: number | undefined
    }
  | { type: 'select' | 'radio'; label: string; options: { label: string; value: unknown }[] }
  | {
      type: 'object'
      label: string
      objectFields: Record<string, LiquidField>
      metadata?: Record<string, unknown> | undefined
    }
  | {
      type: 'array'
      label: string
      arrayFields: Record<string, LiquidField>
      defaultItemProps?: Record<string, unknown> | undefined
      metadata?: Record<string, unknown> | undefined
      max?: number | undefined
    }

const yesNo = (label: string): LiquidField => ({
  type: 'radio',
  label,
  options: [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
  ],
})

/** What the theme itself offers to pick from: its colour schemes (`settings.color_schemes`). */
export type LiquidFieldOptions = { colorSchemes?: string[] | undefined }

/** `scheme-1` → `Scheme 1`. */
const schemeLabel = (id: string) => id.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

/** One schema setting as an editor field, or null for label-only settings. */
function settingField(
  setting: ShopifySetting,
  locale: Record<string, unknown>,
  options: LiquidFieldOptions = {},
): LiquidField | null {
  if (!isValueSetting(setting)) return null
  const label = schemaText(setting.label, locale) || setting.id
  switch (setting.type) {
    case 'checkbox':
      return yesNo(label)
    case 'number':
      return { type: 'number', label }
    case 'range':
      return {
        type: 'number',
        label: setting.unit ? `${label} (${setting.unit})` : label,
        min: setting.min,
        max: setting.max,
        step: setting.step,
      }
    case 'select':
    case 'radio':
    case 'text_alignment':
      return {
        type: setting.type === 'radio' ? 'radio' : 'select',
        label,
        options: (
          setting.options ?? [
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]
        ).map((o) => ({ label: schemaText(o.label, locale) || o.value, value: o.value })),
      }
    case 'image_picker':
      return {
        type: 'object',
        label,
        objectFields: {
          url: { type: 'text', label: 'Image URL' },
          alt: { type: 'text', label: 'Alt text' },
        },
      }
    case 'textarea':
    case 'richtext':
    case 'inline_richtext':
    case 'html':
    case 'liquid':
      return { type: 'textarea', label }
    case 'product':
      return { type: 'text', label: `${label} (product handle)` }
    case 'collection':
      return { type: 'text', label: `${label} (collection handle)` }
    case 'blog':
      return { type: 'text', label: `${label} (blog handle)` }
    case 'page':
      return { type: 'text', label: `${label} (page handle)` }
    case 'link_list':
      return { type: 'text', label: `${label} (menu handle)` }
    case 'color':
    case 'color_background':
      return { type: 'text', label, placeholder: '#000000' }
    case 'color_scheme':
      return options.colorSchemes?.length
        ? {
            type: 'select',
            label,
            options: [
              { label: 'Default', value: '' },
              ...options.colorSchemes.map((id) => ({ label: schemeLabel(id), value: id })),
            ],
          }
        : { type: 'text', label }
    default:
      return { type: 'text', label, placeholder: setting.placeholder }
  }
}

/** Fields for a list of settings, keyed by prop. */
function settingsFields(
  settings: ShopifySetting[] | undefined,
  locale: Record<string, unknown>,
  options: LiquidFieldOptions = {},
): Record<string, LiquidField> {
  const out: Record<string, LiquidField> = {}
  for (const s of settings ?? []) {
    const field = s.id ? settingField(s, locale, options) : null
    if (field && s.id) out[settingPropKey(s.id)] = field
  }
  return out
}

/**
 * All editor fields for one imported section: its settings, then its blocks. Blocks
 * differ by type, so the array item's `settings` object carries every type's fields in
 * `metadata.liquidBlockFields`; Customize shows the item's own type only.
 */
export function liquidSectionFields(
  schema: ShopifySectionSchema | null | undefined,
  locale: Record<string, unknown>,
  themeBlocks: Record<string, ShopifySectionSchema> = {},
  options: LiquidFieldOptions = {},
): Record<string, LiquidField> {
  const fields = settingsFields(schema?.settings, locale, options)
  const blockTypes = (schema?.blocks ?? []).filter((b) => b.type !== '@app')
  if (blockTypes.length === 0) return fields
  const perType: Record<string, Record<string, LiquidField>> = {}
  const names: Record<string, string> = {}
  for (const b of blockTypes) {
    const settings = b.type === '@theme' ? undefined : (b.settings ?? themeBlocks[b.type]?.settings)
    perType[b.type] = settingsFields(settings, locale, options)
    names[b.type] = schemaText(b.name, locale) || themeBlocks[b.type]?.name || b.type
  }
  fields.blocks = {
    type: 'array',
    label: 'Blocks',
    ...(schema?.max_blocks ? { max: schema.max_blocks } : {}),
    metadata: { liquidBlockNames: names },
    arrayFields: {
      settings: {
        type: 'object',
        label: 'Settings',
        objectFields: {},
        metadata: { liquidBlockFields: perType },
      },
    },
  }
  return fields
}
