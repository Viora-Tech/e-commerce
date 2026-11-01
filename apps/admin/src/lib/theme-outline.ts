import {
  fitOutline,
  outlineText,
  THEME_OUTLINE_LIMITS,
  type ThemeOutline,
  type ThemeOutlineBlock,
  type ThemeOutlineSection,
  type ThemeOutlineSetting,
  type ThemeSettingKind,
} from '@commerce/ai/client'
import type { TemplateSection } from '@commerce/core/theme'
import {
  blocksFromProps,
  isValueSetting,
  LIQUID_SECTION,
  type LiquidBlockItem,
  type ShopifySetting,
  schemaText,
  settingPropKey,
} from '@commerce/core/theme-import'
import { type CustomizeDoc, FOOTER_ZONE, HEADER_ZONE } from './customize-doc'
import { sectionName } from './customize-insert'
import type { ImportedTheme } from './imported-sections'

/**
 * The open page as the editor's AI chat sends it (`@commerce/ai` theme-outline): each section
 * in order (header, page, footer) with its label and its text-like and simple settings, an
 * imported section's blocks too, values cut short and the whole outline fitted to its size.
 * Built from Puck's data in the browser on every message, so it is what is on screen now,
 * unsaved edits included. Plain logic with no JSX, so it sits outside the component rule.
 */

/** A native section's Puck component, as far as the outline reads it. */
export type OutlineComponent = {
  label?: string | undefined
  fields?: Record<string, unknown> | undefined
}

export type OutlineSource = {
  doc: CustomizeDoc
  /** Puck's `config.components`: labels and fields of our own sections. */
  components: Record<string, OutlineComponent>
  /** An imported theme's schemas; null for our own themes. */
  imported: ImportedTheme | null
  theme: { name: string; published: boolean }
  templateLabel: string
  selectedSectionId: string | null
}

const L = THEME_OUTLINE_LIMITS

/** Props a section keeps for the editor, never offered as settings. */
const INTERNAL = new Set(['id', '_name', '_hidden', '_aboveFold', 'editMode', 'puck'])

/** Body copy (HTML) as the plain text the outline shows. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/** One setting's value as the outline carries it, or null when it is not a simple value. */
function outlineValue(
  kind: ThemeSettingKind,
  raw: unknown,
): Pick<ThemeOutlineSetting, 'value' | 'truncated'> | null {
  if (kind === 'checkbox') return typeof raw === 'boolean' ? { value: raw } : { value: false }
  // A picture is stored as `{ url, alt }` (ImageField) or, fresh from a Shopify import, a string.
  if (kind === 'image') {
    const url =
      typeof raw === 'string'
        ? raw
        : raw && typeof raw === 'object'
          ? (raw as { url?: unknown }).url
          : ''
    const { value, truncated } = outlineText(typeof url === 'string' ? url : '')
    return truncated ? { value, truncated } : { value }
  }
  if (kind === 'number') return typeof raw === 'number' ? { value: raw } : { value: null }
  if (raw !== undefined && raw !== null && typeof raw !== 'string' && typeof raw !== 'number') {
    return null
  }
  const text = raw === undefined || raw === null ? '' : String(raw)
  const { value, truncated } = outlineText(kind === 'richtext' ? htmlToText(text) : text)
  return truncated ? { value, truncated } : { value }
}

function setting(
  key: string,
  label: string,
  kind: ThemeSettingKind,
  raw: unknown,
  extra: Pick<ThemeOutlineSetting, 'options' | 'min' | 'max'> = {},
): ThemeOutlineSetting | null {
  const value = outlineValue(kind, raw)
  if (!value) return null
  return { key, label: label.slice(0, 120), kind, ...value, ...extra }
}

const limitList = <T>(list: (T | null)[], max: number): T[] =>
  list.filter((x): x is T => x !== null).slice(0, max)

const optionValues = (options: unknown): (string | number)[] =>
  (Array.isArray(options) ? options : [])
    .map((o) => (o && typeof o === 'object' ? (o as { value?: unknown }).value : undefined))
    .filter((v): v is string | number => typeof v === 'string' || typeof v === 'number')
    .map((v) => (typeof v === 'string' ? v.slice(0, L.maxValue) : v))
    .slice(0, L.maxOptions)

// `buttonUrl`, `href`, and an object part like `button.href`.
const LINKISH = /(^|[a-z.])(url|href|link)$/i

type ObjectField = { type?: unknown; label?: unknown; objectFields?: unknown }

/**
 * An object field of our own sections as settings: a picture (`{ url, alt }`, imageField) is one
 * image setting under its own key; anything else, like a button (`{ label, href }`), gives one
 * setting per simple part under `key.part`, which the apply step writes back into the object.
 */
function objectSettings(key: string, field: ObjectField, raw: unknown): ThemeOutlineSetting[] {
  const parts =
    field.objectFields && typeof field.objectFields === 'object'
      ? (field.objectFields as Record<string, unknown>)
      : {}
  const label = typeof field.label === 'string' && field.label ? field.label : key
  if ('url' in parts && 'alt' in parts) {
    const one = setting(key, label, 'image', raw)
    return one ? [one] : []
  }
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return Object.entries(parts).flatMap(([part, sub]) => {
    const s = nativeSetting(`${key}.${part}`, sub, value[part])
    if (!s) return []
    const subLabel = (sub as { label?: unknown } | null)?.label
    return [
      { ...s, label: `${label} · ${typeof subLabel === 'string' ? subLabel : part}`.slice(0, 120) },
    ]
  })
}

/** A Puck field of our own sections as an outline setting, when it is a simple one. */
function nativeSetting(key: string, field: unknown, raw: unknown): ThemeOutlineSetting | null {
  if (!field || typeof field !== 'object') return null
  const f = field as {
    type?: unknown
    label?: unknown
    options?: unknown
    min?: unknown
    max?: unknown
  }
  const label = typeof f.label === 'string' && f.label ? f.label : key
  const bounds = {
    ...(typeof f.min === 'number' ? { min: f.min } : {}),
    ...(typeof f.max === 'number' ? { max: f.max } : {}),
  }
  switch (f.type) {
    case 'text':
      return setting(key, label, LINKISH.test(key) ? 'url' : 'text', raw)
    case 'textarea':
      return setting(key, label, 'textarea', raw)
    case 'richtext':
      return setting(key, label, 'richtext', raw)
    case 'number':
      return setting(key, label, 'number', raw, bounds)
    case 'select':
    case 'radio': {
      const raws = (Array.isArray(f.options) ? f.options : []).map(
        (o) => (o as { value?: unknown } | null)?.value,
      )
      if (raws.length > 0 && raws.every((v) => typeof v === 'boolean')) {
        return setting(key, label, 'checkbox', raw)
      }
      const options = optionValues(f.options)
      return options.length ? setting(key, label, 'select', raw, { options }) : null
    }
    default:
      return null
  }
}

/** A Shopify schema setting's kind in the outline; null for images, colours, code and pickers. */
function liquidKind(type: string): ThemeSettingKind | null {
  switch (type) {
    case 'text':
    case 'inline_richtext':
      return 'text'
    case 'textarea':
      return 'textarea'
    case 'richtext':
      return 'richtext'
    case 'url':
      return 'url'
    case 'checkbox':
      return 'checkbox'
    case 'image_picker':
      return 'image'
    case 'number':
    case 'range':
      return 'number'
    case 'select':
    case 'radio':
    case 'text_alignment':
      return 'select'
    default:
      return null
  }
}

const ALIGNMENTS = ['left', 'center', 'right']

function liquidSettings(
  settings: ShopifySetting[] | undefined,
  values: Record<string, unknown>,
  locale: Record<string, unknown>,
  keyOf: (id: string) => string,
): ThemeOutlineSetting[] {
  return limitList(
    (settings ?? []).map((s) => {
      if (!isValueSetting(s)) return null
      const kind = liquidKind(s.type)
      if (!kind) return null
      const key = keyOf(s.id)
      const raw = key in values ? values[key] : s.default
      const label = schemaText(s.label, locale) || s.id
      const extra =
        kind === 'select'
          ? { options: optionValues(s.options ?? ALIGNMENTS.map((value) => ({ value }))) }
          : kind === 'number'
            ? {
                ...(typeof s.min === 'number' ? { min: s.min } : {}),
                ...(typeof s.max === 'number' ? { max: s.max } : {}),
              }
            : {}
      return setting(key, label, kind, raw, extra)
    }),
    L.maxSettings,
  )
}

/** Every block of an imported section, nested ones after their parent. */
function flatBlocks(blocks: LiquidBlockItem[]): LiquidBlockItem[] {
  return blocks.flatMap((b) => [b, ...flatBlocks(b.blocks ?? [])])
}

function liquidSection(
  section: TemplateSection,
  zone: ThemeOutlineSection['zone'],
  imported: ImportedTheme | null,
): ThemeOutlineSection {
  const props = section.props as Record<string, unknown>
  const type = typeof props.sectionType === 'string' ? props.sectionType : ''
  const schema = imported?.schemas[type]
  const locale = imported?.schemaLocale ?? {}
  const label = sectionName(section, schemaText(schema?.name, locale) || type || LIQUID_SECTION)
  const blocks: ThemeOutlineBlock[] = flatBlocks(blocksFromProps(props))
    .slice(0, L.maxBlocks)
    .map((block) => {
      const blockSchema = (schema?.blocks ?? []).find((b) => b.type === block.type)
      const themeBlock = imported?.blockSchemas[block.type]
      const settings = blockSchema?.settings ?? themeBlock?.settings
      return {
        id: block.id.slice(0, 120),
        type: block.type.slice(0, 120),
        label: (schemaText(blockSchema?.name, locale) || themeBlock?.name || block.type).slice(
          0,
          120,
        ),
        settings: liquidSettings(settings, block.settings, locale, (id) => id),
      }
    })
  return {
    id: String(props.id),
    zone,
    type: type.slice(0, 120),
    label: label.slice(0, 120),
    settings: liquidSettings(schema?.settings, props, locale, settingPropKey),
    blocks,
  }
}

function nativeSection(
  section: TemplateSection,
  zone: ThemeOutlineSection['zone'],
  component: OutlineComponent | undefined,
): ThemeOutlineSection {
  const props = section.props as Record<string, unknown>
  const fields = component?.fields ?? {}
  return {
    id: String(props.id),
    zone,
    type: section.type.slice(0, 120),
    label: sectionName(section, component?.label || section.type).slice(0, 120),
    settings: limitList(
      Object.entries(fields)
        .filter(([key]) => !INTERNAL.has(key))
        .flatMap(([key, field]) =>
          (field as ObjectField | null)?.type === 'object'
            ? objectSettings(key, field as ObjectField, props[key])
            : [nativeSetting(key, field, props[key])],
        ),
      L.maxSettings,
    ),
    blocks: [],
  }
}

/**
 * The outline of the open page, fitted to `THEME_OUTLINE_LIMITS.maxSentSize`: the whole page as a
 * rule. The server cuts the prompt's copy to `maxSize` and keeps this one for `sectionSettings`.
 */
export function buildThemeOutline(source: OutlineSource): ThemeOutline {
  const zones: [ThemeOutlineSection['zone'], TemplateSection[]][] = [
    ['header', source.doc.zones[HEADER_ZONE] ?? []],
    ['main', source.doc.content],
    ['footer', source.doc.zones[FOOTER_ZONE] ?? []],
  ]
  const sections = zones
    .flatMap(([zone, list]) =>
      list.map((section) =>
        section.type === LIQUID_SECTION
          ? liquidSection(section, zone, source.imported)
          : nativeSection(section, zone, source.components[section.type]),
      ),
    )
    .filter((s) => s.id.length > 0 && s.id.length <= 120)
  const selected = source.selectedSectionId
  const kept = sections.slice(0, L.maxSections)
  const chosen =
    selected && !kept.some((s) => s.id === selected)
      ? [...kept.slice(0, -1), ...sections.filter((s) => s.id === selected)]
      : kept
  return fitOutline(
    {
      themeName: source.theme.name.slice(0, 120),
      templateLabel: source.templateLabel.slice(0, 120),
      published: source.theme.published,
      selectedSectionId: selected && chosen.some((s) => s.id === selected) ? selected : null,
      partial: sections.length > chosen.length,
      sections: chosen,
    },
    L.maxSentSize,
  )
}
