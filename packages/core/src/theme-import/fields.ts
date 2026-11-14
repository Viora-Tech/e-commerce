/** SOURCE OF TRUTH: imported sections as Puck data and editor fields — WHAT: how a Shopify section (settings, blocks) is stored in a theme template as a `LiquidSection` (prop keys, block items), how it reads back for the Liquid engine, and the editor fields generated from its `{% schema %}` / WHY: the importer writes this shape, the storefront and the canvas render from it, and Customize edits it; all three must agree. Browser safe */
import { z } from 'zod'
import type { ShopifySectionSchema, ShopifySetting } from './schema'
import { isValueSetting, MAX_BLOCK_DEPTH } from './schema'

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
export const settingPropKey = (id: string): string => (RESERVED.has(id) ? `setting_${id}` : id)

/** One block, as an item of the section's `blocks` array. */
export type LiquidBlockItem = {
  id: string
  type: string
  disabled?: boolean | undefined
  /** Placed by the theme's code (`content_for 'block'`), not listed with the others. */
  static?: boolean | undefined
  settings: Record<string, unknown>
  /** Nested theme blocks (a tab's contents), what `{% content_for 'blocks' %}` lists inside this block. */
  blocks?: LiquidBlockItem[] | undefined
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
  return blockItems(props.blocks, 0)
}

/** One level of saved blocks and, below it, their nested blocks (at most `MAX_BLOCK_DEPTH` deep). */
function blockItems(raw: unknown, depth: number): LiquidBlockItem[] {
  if (!Array.isArray(raw) || depth >= MAX_BLOCK_DEPTH) return []
  return raw.flatMap((b, i) => {
    if (!b || typeof b !== 'object') return []
    const item = b as Partial<LiquidBlockItem>
    if (typeof item.type !== 'string') return []
    const nested = blockItems(item.blocks, depth + 1)
    return [
      {
        id: typeof item.id === 'string' && item.id ? item.id : `block_${i}`,
        type: item.type,
        disabled: item.disabled === true,
        ...(item.static === true ? { static: true } : {}),
        settings: item.settings && typeof item.settings === 'object' ? item.settings : {},
        ...(nested.length ? { blocks: nested } : {}),
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

const BLOCK_FIELDS = {
  id: z.string().min(1).max(80),
  type: z.string().min(1).max(100),
  disabled: z.boolean().optional(),
  static: z.boolean().optional(),
  settings: z.record(z.string(), z.unknown()),
}

/** A block as the canvas sends it, nested blocks included, as deep as the theme may go. */
function blockSchema(depth: number): z.ZodType<LiquidBlockItem> {
  if (depth <= 1) return z.object(BLOCK_FIELDS)
  return z.object({
    ...BLOCK_FIELDS,
    blocks: z
      .array(blockSchema(depth - 1))
      .max(100)
      .optional(),
  })
}

/**
 * The checked shape of `LiquidSectionPlacement`. It has to carry everything the engine reads:
 * a dropped `static` makes a block the merchant turned off draw itself with the theme's defaults.
 */
export const LiquidSectionPlacementSchema: z.ZodType<LiquidSectionPlacement> = z.object({
  id: z.string().min(1).max(80),
  type: z.string().min(1).max(100),
  settings: z.record(z.string(), z.unknown()),
  blocks: z.array(blockSchema(MAX_BLOCK_DEPTH)).max(100),
  location: z.string().min(1).max(40),
  index: z.number().int().min(0).max(100),
})

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
/** The setting's own help (`info` in the schema), shown under the field in Customize (#129). */
type FieldHelp = { metadata?: { help?: string | undefined } | undefined }

export type LiquidField =
  | ({ type: 'text' | 'textarea'; label: string; placeholder?: string | undefined } & FieldHelp)
  | ({
      type: 'number'
      label: string
      min?: number | undefined
      max?: number | undefined
      step?: number | undefined
    } & FieldHelp)
  | ({
      type: 'select' | 'radio'
      label: string
      options: { label: string; value: unknown }[]
    } & FieldHelp)
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

/**
 * One schema setting as an editor field, or null for label-only settings. Shopify explains
 * settings in `info` ("Full width suits slides designed edge-to-edge…"); it rides along as the
 * field's help so merchants are not guessing (audit #129).
 */
export function settingField(
  setting: ShopifySetting,
  locale: Record<string, unknown>,
  options: LiquidFieldOptions = {},
): LiquidField | null {
  const field = bareSettingField(setting, locale, options)
  const help = schemaText(setting.info, locale)
    .replace(/<[^>]*>/g, '')
    .trim()
  if (!field || !help) return field
  if (field.type === 'object' || field.type === 'array') return field
  return { ...field, metadata: { help } }
}

function bareSettingField(
  setting: ShopifySetting,
  locale: Record<string, unknown>,
  options: LiquidFieldOptions,
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
    case 'video':
      return {
        type: 'object',
        label,
        objectFields: {
          url: { type: 'text', label: 'Video URL (mp4)' },
          mobileUrl: { type: 'text', label: 'Phone-sized video URL (mp4, optional)' },
          poster: {
            type: 'object',
            label: 'Poster picture',
            objectFields: { url: { type: 'text', label: 'Image URL' } },
          },
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
 * Our own "Cookie settings" link in an imported theme's footer (`sections/footer.liquid`): the
 * storefront adds it to the footer's policy links, so a shopper can change their cookie answer
 * (the theme's banner and ours both open on `#cookie-settings`). On unless this prop is `false`.
 */
const COOKIE_SETTINGS_LINK_PROP = '_cookieSettingsLink'

/** Whether an imported footer section gets the "Cookie settings" link. */
export function showsCookieSettingsLink(sectionType: string, props: Record<string, unknown>) {
  return sectionType === 'footer' && props[COOKIE_SETTINGS_LINK_PROP] !== false
}

/** Fields we add to an imported section beside its theme's own (Customize). */
export function platformSectionFields(sectionType: string): Record<string, LiquidField> {
  if (sectionType !== 'footer') return {}
  return {
    [COOKIE_SETTINGS_LINK_PROP]: {
      type: 'radio',
      label: 'Cookie settings link',
      options: [
        { label: 'Show', value: true },
        { label: 'Hide', value: false },
      ],
      metadata: {
        help: 'Adds "Cookie settings" beside the policy links, so shoppers can change their cookie choice. Shown unless you hide it.',
      },
    },
  }
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
