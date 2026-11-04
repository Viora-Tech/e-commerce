/** SOURCE OF TRUTH: liquidThemeLogoUrl — WHAT: the logo an imported Shopify theme draws in its header: an image setting named like "logo" on a header-group section, else in the theme settings (`settings_data.json`) / WHY: an imported theme keeps its logo in its own settings, not in our `theme.brand`, and the Inbox chat header shows it as the store's avatar. */

import type { ThemeBundle } from './bundle'
import { settingPropKey } from './fields'
import type { ShopifySetting } from './schema'

/** A header-group item as saved (Puck content). */
type HeaderItem = { type: string; props: Record<string, unknown> }

const LOGO_ID = /logo/i
/** Variants a theme draws only in some places (over a hero, on a dark footer, on phones). */
const VARIANT_ID = /transparent|inverse|invert|mobile|sticky|footer|white|light|dark|alt|secondary/i

/** A stored image setting's URL: `{ url }` or a plain string; never a `shopify://` reference. */
function urlOf(value: unknown): string | null {
  const raw =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object' && typeof (value as { url?: unknown }).url === 'string'
        ? (value as { url: string }).url
        : ''
  const url = raw.trim()
  if (!url || url.startsWith('shopify://')) return null
  return /^https?:\/\//i.test(url) || url.startsWith('//') || url.startsWith('/') ? url : null
}

const isLogoSetting = (s: ShopifySetting): s is ShopifySetting & { id: string } =>
  s.type === 'image_picker' && typeof s.id === 'string' && LOGO_ID.test(s.id)

/**
 * The imported theme's header logo URL, or null. Header-group sections come first (in order),
 * then the theme settings; a plain `logo` beats variants such as `logo_transparent`.
 */
export function liquidThemeLogoUrl(
  header: HeaderItem[],
  bundle: Pick<ThemeBundle, 'sections' | 'settings' | 'settingsSchema'>,
): string | null {
  const found = themeLogos(header, bundle)
  return (found.find((f) => !VARIANT_ID.test(f.id)) ?? found[0])?.url ?? null
}

/** The logo the theme keeps for dark backgrounds (`logo_dark`), or null when it has none. */
export function liquidThemeDarkLogoUrl(
  header: HeaderItem[],
  bundle: Pick<ThemeBundle, 'sections' | 'settings' | 'settingsSchema'>,
): string | null {
  return themeLogos(header, bundle).find((f) => /dark/i.test(f.id))?.url ?? null
}

function themeLogos(
  header: HeaderItem[],
  bundle: Pick<ThemeBundle, 'sections' | 'settings' | 'settingsSchema'>,
): { id: string; url: string }[] {
  const found: { id: string; url: string }[] = []
  for (const item of header) {
    const type = item.props.sectionType
    if (typeof type !== 'string') continue
    for (const s of bundle.sections.get(type)?.schema?.settings ?? []) {
      if (!isLogoSetting(s)) continue
      const url = urlOf(item.props[settingPropKey(s.id)])
      if (url) found.push({ id: s.id, url })
    }
  }
  for (const group of bundle.settingsSchema) {
    for (const s of group.settings ?? []) {
      if (!isLogoSetting(s)) continue
      const url = urlOf(bundle.settings[s.id])
      if (url) found.push({ id: s.id, url })
    }
  }
  return found
}
