import type { ColorScheme, StatusColors, Theme, ThemePresetId } from './schema'
import { defaultTheme } from './schema'

type Roles = Omit<ColorScheme, 'id' | 'name'>

type Preset = {
  light: Roles
  dark: Roles
  shared: StatusColors
  sharedDark: StatusColors
  fonts: Theme['fonts']
  shape: Theme['shape']
  layout: Theme['layout']
  buttons: Theme['buttons']
  cards: Theme['cards']
  roundedSections: boolean
}

const roles = (s: ColorScheme): Roles => {
  const { id: _id, name: _name, ...rest } = s
  return rest
}

const byId = (id: string): ColorScheme => {
  const s = defaultTheme.schemes.find((x) => x.id === id)
  if (!s) throw new Error(`default theme has no scheme ${id}`)
  return s
}

/** Starting points. Each fills every value except the brand (logo and favicon). */
export const THEME_PRESETS: Record<ThemePresetId, Preset> = {
  waimers: {
    light: roles(byId(defaultTheme.lightScheme)),
    dark: roles(byId(defaultTheme.darkScheme)),
    shared: defaultTheme.shared,
    sharedDark: defaultTheme.sharedDark,
    fonts: defaultTheme.fonts,
    shape: defaultTheme.shape,
    layout: defaultTheme.layout,
    buttons: defaultTheme.buttons,
    cards: defaultTheme.cards,
    roundedSections: defaultTheme.roundedSections,
  },
  minimal: {
    light: {
      background: '#FFFFFF',
      text: '#111111',
      textMuted: '#5F5F63',
      line: '#E8E8E8',
      surface: '#F7F7F7',
      button: '#111111',
      buttonText: '#FFFFFF',
      accent: '#111111',
    },
    dark: {
      background: '#0E0E0F',
      text: '#F4F4F5',
      textMuted: '#A1A1A8',
      line: '#26262A',
      surface: '#18181B',
      button: '#F4F4F5',
      buttonText: '#0E0E0F',
      accent: '#F4F4F5',
    },
    shared: { success: '#1F7A4D', danger: '#C22F1C', sale: '#111111' },
    sharedDark: { success: '#3DBA7A', danger: '#F2604B', sale: '#F4F4F5' },
    fonts: {
      heading: 'inter',
      body: 'inter',
      headingScale: 0.95,
      bodySizePx: 15,
      headingTracking: -0.02,
    },
    shape: { buttonRadius: 4, cardRadius: 4, inputRadius: 4, borderWidth: 1 },
    layout: { pageWidth: 1280, sectionSpacing: 1.1 },
    buttons: { style: 'solid', colour: 'text', uppercase: false },
    cards: { imageRatio: 'portrait', showVendor: true, showSaleBadge: true, hoverImage: true },
    roundedSections: false,
  },
  bold: {
    light: {
      background: '#F5F3EE',
      text: '#0B0B0C',
      textMuted: '#55555B',
      line: '#0B0B0C',
      surface: '#FFFFFF',
      button: '#FF4D17',
      buttonText: '#0B0B0C',
      accent: '#FF4D17',
    },
    dark: {
      background: '#0B0B0C',
      text: '#F5F3EE',
      textMuted: '#A8A6A0',
      line: '#F5F3EE',
      surface: '#17171A',
      button: '#FF4D17',
      buttonText: '#0B0B0C',
      accent: '#FF4D17',
    },
    shared: { success: '#12804A', danger: '#C81E1E', sale: '#FF4D17' },
    sharedDark: { success: '#3DBA7A', danger: '#F2604B', sale: '#FF6A3D' },
    fonts: {
      heading: 'space-grotesk',
      body: 'inter',
      headingScale: 1.2,
      bodySizePx: 16,
      headingTracking: -0.03,
    },
    shape: { buttonRadius: 0, cardRadius: 0, inputRadius: 0, borderWidth: 2 },
    layout: { pageWidth: 1440, sectionSpacing: 0.9 },
    buttons: { style: 'solid', colour: 'brand', uppercase: true },
    cards: { imageRatio: 'square', showVendor: true, showSaleBadge: true, hoverImage: true },
    roundedSections: false,
  },
  soft: {
    light: {
      background: '#FBF7F2',
      text: '#2B2622',
      textMuted: '#716960',
      line: '#EBE3D9',
      surface: '#FFFFFF',
      button: '#B8614F',
      buttonText: '#FFFFFF',
      accent: '#B8614F',
    },
    dark: {
      background: '#1C1916',
      text: '#F3EDE6',
      textMuted: '#B3A89C',
      line: '#35302A',
      surface: '#26221E',
      button: '#E09A89',
      buttonText: '#1C1916',
      accent: '#E09A89',
    },
    shared: { success: '#3F7D58', danger: '#B6412E', sale: '#B8614F' },
    sharedDark: { success: '#7CC49A', danger: '#F08A74', sale: '#E09A89' },
    fonts: {
      heading: 'fraunces',
      body: 'dm-sans',
      headingScale: 1.1,
      bodySizePx: 16,
      headingTracking: -0.01,
    },
    shape: { buttonRadius: 24, cardRadius: 16, inputRadius: 12, borderWidth: 1 },
    layout: { pageWidth: 1360, sectionSpacing: 1.2 },
    buttons: { style: 'solid', colour: 'brand', uppercase: false },
    cards: { imageRatio: 'portrait', showVendor: false, showSaleBadge: true, hoverImage: true },
    roundedSections: true,
  },
}

/**
 * The theme with a preset's values applied. The page's light and dark schemes take
 * the preset's colours; other section schemes, dark mode behaviour and the brand
 * (logo, favicon) are kept.
 */
export function applyThemePreset(theme: Theme, id: ThemePresetId): Theme {
  const p = THEME_PRESETS[id]
  const schemes = theme.schemes.map((s) => {
    if (s.id === theme.lightScheme) return { ...s, ...p.light }
    if (s.id === theme.darkScheme) return { ...s, ...p.dark }
    return s
  })
  return {
    ...theme,
    schemes,
    shared: p.shared,
    sharedDark: p.sharedDark,
    fonts: p.fonts,
    shape: p.shape,
    layout: p.layout,
    buttons: p.buttons,
    cards: p.cards,
    roundedSections: p.roundedSections,
    preset: id,
  }
}
