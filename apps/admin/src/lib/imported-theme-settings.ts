import { THEME_FONT_IDS, THEME_FONTS } from '@commerce/core/theme'
import {
  fontFamilyKey,
  fontFamilyLabel,
  fontHandleFamily,
  isValueSetting,
  type ShopifySetting,
  schemaText,
  settingDefaults,
  type ThemeSettingsGroup,
  withFontFamily,
} from '@commerce/core/theme-import'

/**
 * Customize's Theme settings for a theme imported from Shopify: the one-line summary under each
 * group's row, the row's icon, the font choices, and which values changed since the last save.
 */

export type ImportedSummaryCopy = {
  /** No setting of the group says anything worth a summary. */
  empty: string
  /** A `color_scheme_group`: how many schemes. */
  schemes: (count: number) => string
}

/** Longest text a summary quotes before it is cut. */
const QUOTE_MAX = 32
/** How many settings one summary names. */
const SUMMARY_PARTS = 3

const plain = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const quote = (text: string) =>
  text.length > QUOTE_MAX ? `${text.slice(0, QUOTE_MAX - 1).trimEnd()}…` : text

/** A `font_picker` handle's family as people read it: one of the store's typefaces by its own name. */
export function fontLabel(handle: string): string {
  const family = fontHandleFamily(handle)
  const ours = THEME_FONT_IDS.find((id) => fontFamilyKey(THEME_FONTS[id].label) === family)
  return ours ? THEME_FONTS[ours].label : fontFamilyLabel(family)
}

/** `#abc` → `#AABBCC`; anything else that is not a whole colour → null. */
export function swatchHex(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value)
  if (short)
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toUpperCase()
  const long = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(value)
  return long ? `#${long[1]}`.toUpperCase() : null
}

/** Where a colour picker starts when neither the value nor the theme's default is a colour. */
const PICKER_START = '#000000'

/** A colour setting's swatch: its value, else the theme's default, else black. */
export const swatchValue = (value: unknown, fallback: unknown): string =>
  swatchHex(value) ?? swatchHex(fallback) ?? PICKER_START

/** What one setting is set to, in a few words; null when it says nothing (off, empty). */
export function settingSummary(
  setting: ShopifySetting,
  value: unknown,
  locale: Record<string, unknown>,
  copy: ImportedSummaryCopy,
): string | null {
  const label = schemaText(setting.label, locale) || setting.id || ''
  switch (setting.type) {
    case 'checkbox':
      return value === true ? label : null
    case 'select':
    case 'radio':
    case 'text_alignment': {
      const option = setting.options?.find((o) => o.value === value)
      return option ? schemaText(option.label, locale) || option.value : null
    }
    case 'range':
    case 'number':
      return typeof value === 'number' ? `${label} ${value}${setting.unit ?? ''}` : null
    case 'color':
      return swatchHex(value)
    case 'font_picker':
      return typeof value === 'string' && value ? fontLabel(value) : null
    case 'image_picker': {
      const url =
        value && typeof value === 'object' ? (value as { url?: unknown }).url : (value ?? '')
      return typeof url === 'string' && url && !url.startsWith('shopify://') ? label : null
    }
    case 'color_scheme_group': {
      const count = value && typeof value === 'object' ? Object.keys(value).length : 0
      return count ? copy.schemes(count) : null
    }
    case 'text':
    case 'textarea':
    case 'richtext':
    case 'inline_richtext': {
      const text = typeof value === 'string' ? plain(value) : ''
      return text ? quote(text) : null
    }
    default:
      return null
  }
}

/**
 * The line under a group's row: what its first few settings are set to (defaults where the
 * theme saved nothing), e.g. "Favicon · Logo width 140px".
 */
export function importedGroupSummary(
  group: ThemeSettingsGroup,
  values: Record<string, unknown>,
  locale: Record<string, unknown>,
  copy: ImportedSummaryCopy,
): string {
  const current = { ...settingDefaults(group.settings), ...values }
  const parts = group.settings
    .filter(isValueSetting)
    .flatMap((s) => settingSummary(s, current[s.id], locale, copy) ?? [])
  return parts.length ? parts.slice(0, SUMMARY_PARTS).join(' · ') : copy.empty
}

/** Which icon a group's row shows, read from its (English) name. */
export type ImportedGroupIcon =
  | 'brand'
  | 'colours'
  | 'typography'
  | 'layout'
  | 'cart'
  | 'social'
  | 'search'
  | 'products'
  | 'media'
  | 'code'
  | 'prices'
  | 'other'

const ICON_RULES: [RegExp, ImportedGroupIcon][] = [
  [/logo|favicon|brand|identity/i, 'brand'],
  [/colou?r|scheme/i, 'colours'],
  [/typo|font|text/i, 'typography'],
  [/layout|width|spacing|grid/i, 'layout'],
  [/cart|checkout/i, 'cart'],
  [/social/i, 'social'],
  [/search/i, 'search'],
  [/product|card|badge|collection|variant/i, 'products'],
  [/image|media|video/i, 'media'],
  [/css|code|script/i, 'code'],
  [/currenc|price|discount/i, 'prices'],
]

export const importedGroupIcon = (name: string): ImportedGroupIcon =>
  ICON_RULES.find(([re]) => re.test(name))?.[1] ?? 'other'

/**
 * The fonts a `font_picker` offers: the store's curated typefaces in the setting's weight and
 * style, with the theme's current font first when it is not one of them.
 */
export function fontChoices(current: string): { label: string; value: string }[] {
  const handle = current || 'assistant_n4'
  const ours = THEME_FONT_IDS.map((id) => {
    const family = fontFamilyKey(THEME_FONTS[id].label)
    return { label: THEME_FONTS[id].label, value: withFontFamily(handle, family) }
  })
  if (!current || ours.some((o) => o.value === current)) return ours
  return [{ label: fontLabel(current), value: current }, ...ours]
}

/** The values that differ from the saved ones (a removed value is sent as null). */
export function changedSettings(
  saved: Record<string, unknown>,
  draft: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const id of new Set([...Object.keys(saved), ...Object.keys(draft)])) {
    if (JSON.stringify(saved[id]) !== JSON.stringify(draft[id])) out[id] = draft[id] ?? null
  }
  return out
}
