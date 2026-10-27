/** SOURCE OF TRUTH: an imported theme's own Theme settings — WHAT: the groups of `config/settings_schema.json` as Customize lists them, and what a saved value may be for each setting type (cleaned before it is stored) / WHY: the merchant edits the theme's global settings (favicon, colours, fonts, cart…) in Customize; the editor and the save must agree on the groups and on what reaches the Liquid renderer. Browser safe */
import { schemaText } from './fields'
import { isValueSetting, type ShopifySetting } from './schema'

/** One group of `settings_schema.json` (`Logo`, `Colors`, `Cart`…). */
export type ThemeSettingsSchemaGroup = { name?: string; settings?: ShopifySetting[] }

/** A group Customize lists: its name (locale resolved) and its settings, headers included. */
export type ThemeSettingsGroup = { key: string; name: string; settings: ShopifySetting[] }

/**
 * The groups Customize's Theme settings lists, in the theme's order. `theme_info` (name,
 * version, author) and groups with nothing to set are left out.
 */
export function themeSettingsGroups(
  schema: ThemeSettingsSchemaGroup[],
  locale: Record<string, unknown>,
): ThemeSettingsGroup[] {
  return schema.flatMap((g, i) => {
    if (g.name === 'theme_info') return []
    const settings = g.settings ?? []
    if (!settings.some(isValueSetting)) return []
    return [{ key: `${i}`, name: schemaText(g.name, locale) || `Group ${i + 1}`, settings }]
  })
}

/** Every value setting of the schema, by id. */
export function themeSettingsById(
  schema: ThemeSettingsSchemaGroup[],
): Map<string, ShopifySetting & { id: string }> {
  const out = new Map<string, ShopifySetting & { id: string }>()
  for (const g of schema) for (const s of g.settings ?? []) if (isValueSetting(s)) out.set(s.id, s)
  return out
}

const HEX = /^#[0-9a-f]{3,8}$/i
/** A link or picture address a theme may print into an attribute: http(s) or a site path, no quotes. */
const SAFE_URL = /^(?:https?:\/\/|\/)[^\s"'<>\\`]*$/i
const SHOPIFY_REF = /^shopify:\/\/[\w./-]*$/
const HANDLE = /^[\w-]{1,200}$/
const MAX_TEXT = 20_000
const MAX_LIST = 50
const MAX_SCHEMES = 30

const safeUrl = (v: unknown): string | undefined =>
  typeof v === 'string' && (v === '' || (v.length <= 2000 && SAFE_URL.test(v))) ? v : undefined

const size = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 100_000 ? Math.round(v) : undefined

/** An `image_picker` value as Customize's image picker stores it: `{ url, alt, width?, height? }`. */
function cleanImage(value: unknown): Record<string, unknown> | undefined {
  if (value === null || value === '') return { url: '', alt: '' }
  if (!value || typeof value !== 'object') return undefined
  const v = value as Record<string, unknown>
  const url = safeUrl(v.url ?? '')
  if (url === undefined) return undefined
  const alt = typeof v.alt === 'string' ? v.alt.slice(0, 500) : ''
  const width = size(v.width)
  const height = size(v.height)
  // The picker's focal point, in percent from the top left.
  const f = (v.focal ?? null) as { x?: unknown; y?: unknown } | null
  const focal =
    f && typeof f.x === 'number' && typeof f.y === 'number'
      ? { x: Math.min(100, Math.max(0, f.x)), y: Math.min(100, Math.max(0, f.y)) }
      : undefined
  return {
    url,
    alt,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(focal ? { focal } : {}),
  }
}

/** A `color_scheme_group` value: `{ "scheme-1": { settings: { background: "#fff" } } }`. */
function cleanSchemes(
  setting: ShopifySetting,
  value: unknown,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const definition = (setting.definition ?? []).filter(isValueSetting)
  const out: Record<string, unknown> = {}
  for (const [id, scheme] of Object.entries(value).slice(0, MAX_SCHEMES)) {
    if (!HANDLE.test(id) || !scheme || typeof scheme !== 'object') continue
    const stored = (scheme as { settings?: unknown }).settings
    const values = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {}
    out[id] = { settings: cleanThemeSettings(definition, values) }
  }
  return out
}

/**
 * A setting's value as it may be stored, or undefined when it cannot be one (the save drops
 * it). Choices must be the schema's options, colours whole colours, addresses http(s) or a
 * site path (themes print them into attributes), numbers within the range.
 */
export function cleanThemeSetting(setting: ShopifySetting, value: unknown): unknown {
  const text = typeof value === 'string' && value.length <= MAX_TEXT ? value : undefined
  switch (setting.type) {
    case 'checkbox':
      return typeof value === 'boolean' ? value : undefined
    case 'number':
    case 'range': {
      if (value === null && setting.type === 'number') return null
      if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
      const min = setting.min ?? Number.NEGATIVE_INFINITY
      const max = setting.max ?? Number.POSITIVE_INFINITY
      return Math.min(max, Math.max(min, value))
    }
    case 'select':
    case 'radio':
    case 'text_alignment':
      if (text === undefined) return undefined
      if (setting.options && !setting.options.some((o) => o.value === text)) return undefined
      return text
    case 'color':
      return text === '' || (text && HEX.test(text)) ? text : undefined
    case 'color_background':
      return text !== undefined && !/[<>;{}"\\]/.test(text) ? text : undefined
    case 'image_picker':
      return cleanImage(value)
    case 'font_picker':
      return text && /^[a-z0-9_]{1,80}$/.test(text) ? text : undefined
    case 'color_scheme':
      return text !== undefined && (text === '' || HANDLE.test(text)) ? text : undefined
    case 'color_scheme_group':
      return cleanSchemes(setting, value)
    case 'url':
      return text !== undefined && (safeUrl(text) !== undefined || SHOPIFY_REF.test(text))
        ? text
        : undefined
    case 'video': {
      if (value === null || value === '') return null
      if (!value || typeof value !== 'object') return undefined
      const v = value as Record<string, unknown>
      const url = safeUrl(v.url ?? '')
      if (url === undefined) return undefined
      const mobileUrl = safeUrl(v.mobileUrl ?? '') ?? ''
      const poster = v.poster ? cleanImage(v.poster) : undefined
      return { url, mobileUrl, ...(poster?.url ? { poster } : {}) }
    }
    case 'product_list':
    case 'collection_list':
      return Array.isArray(value)
        ? value
            .filter((h): h is string => typeof h === 'string' && HANDLE.test(h))
            .slice(0, MAX_LIST)
        : undefined
    case 'metaobject':
    case 'metaobject_list':
      return undefined
    default:
      return text
  }
}

/**
 * The values a save may store: only the schema's own settings, each cleaned. Anything else
 * (unknown ids, values of the wrong kind) is left out.
 */
export function cleanThemeSettings(
  schema: ShopifySetting[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const byId = new Map(schema.filter(isValueSetting).map((s) => [s.id, s]))
  const out: Record<string, unknown> = {}
  for (const [id, value] of Object.entries(values)) {
    const setting = byId.get(id)
    if (!setting) continue
    const clean = cleanThemeSetting(setting, value)
    if (clean !== undefined) out[id] = clean
  }
  return out
}

/** A `font_picker` handle's family: `dm_sans_n4` → `dm_sans`. */
export const fontHandleFamily = (handle: string): string =>
  /^(.+)_[nio]\d$/.exec(handle)?.[1] ?? handle

/** A family name as Shopify's font library writes it: `DM Sans` → `dm_sans`. */
export const fontFamilyKey = (label: string): string =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

/** `dm_sans` → `Dm Sans`: how the renderer names the family (see `FontDrop`). */
export const fontFamilyLabel = (family: string): string =>
  family
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

/** The handle for another family in the same weight and style: (`assistant_n7`, `lora`) → `lora_n7`. */
export function withFontFamily(handle: string, family: string): string {
  const variant = /_([nio]\d)$/.exec(handle)?.[1] ?? 'n4'
  return `${family}_${variant}`
}
