import { z } from 'zod'
import { THEME_FONT_IDS } from './fonts'

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'hex colour like #1F1F21')

/** Status colours that do not come from a scheme. One set per mode. */
const StatusColorsSchema = z.object({
  success: hex,
  danger: hex,
  /** Sale badges. Defaults to the Waimers brand purple the badge wore before it had a role. */
  sale: hex.default('#6C3BAA'),
})
export type StatusColors = z.infer<typeof StatusColorsSchema>

/** A picked library image: the id to find it again, the url so the storefront needs no join. */
export const MediaRefSchema = z.object({
  mediaId: z.string().min(1),
  /** Rendered into href/src, so only http(s) or a root-relative path. */
  url: z.string().regex(/^(https?:\/\/|\/(?!\/))/, 'an http(s) or root-relative url'),
})
export type ThemeMediaRef = z.infer<typeof MediaRefSchema>

export const THEME_PRESET_IDS = ['waimers', 'minimal', 'bold', 'soft'] as const
export type ThemePresetId = (typeof THEME_PRESET_IDS)[number]

/*
 * Every group added after the first theme shipped carries a default equal to the
 * look the storefront already had, so a theme saved before it existed parses to
 * the same page it rendered yesterday.
 */
const DEFAULT_SHARED_DARK: StatusColors = {
  // Dark pages painted the light status colours before they had their own.
  success: '#1F9254',
  danger: '#D2331F',
  sale: '#6C3BAA',
}
const DEFAULT_SHAPE = { buttonRadius: 8, cardRadius: 8, inputRadius: 8, borderWidth: 1 }
const DEFAULT_LAYOUT = { pageWidth: 1440, sectionSpacing: 1 }
const DEFAULT_BUTTONS = { style: 'solid', colour: 'text', uppercase: true } as const
const DEFAULT_CARDS = {
  style: 'standard',
  imageRatio: 'square',
  showVendor: false,
  showSaleBadge: false,
  hoverImage: true,
  showRating: true,
  showQuickAdd: false,
  showWishlist: true,
} as const
const DEFAULT_CART = { type: 'page', freeShippingBar: true } as const

/** The networks Theme settings → Social media lists, in its order. */
export const SOCIAL_PLATFORMS = [
  'instagram',
  'whatsapp',
  'youtube',
  'facebook',
  'twitter',
  'discord',
] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]
const DEFAULT_BRAND = { logo: null, logoWidth: 140, favicon: null }

/** One colour scheme, same roles as Zero Drift's color_scheme_group. */
export const ColorSchemeSchema = z.object({
  /** Becomes a CSS class inside the storefront's <style> block, so only a safe slug is allowed. */
  id: z.string().regex(/^[a-z0-9-]{1,40}$/, 'lowercase letters, digits and hyphens'),
  name: z.string().min(1),
  background: hex,
  text: hex,
  textMuted: hex,
  line: hex,
  surface: hex,
  button: hex,
  buttonText: hex,
  accent: hex,
})
export type ColorScheme = z.infer<typeof ColorSchemeSchema>

/** One app embed's state in a theme: on or off, and the settings the merchant changed. */
export const AppEmbedStateSchema = z.object({
  enabled: z.boolean(),
  settings: z.record(z.string(), z.unknown()).default({}),
})
export type AppEmbedState = z.infer<typeof AppEmbedStateSchema>

export const ThemeSchema = z.object({
  schemes: z.array(ColorSchemeSchema).min(1),
  /** Scheme id used on light pages. */
  lightScheme: z.string().regex(/^[a-z0-9-]{1,40}$/),
  /** Scheme id swapped in for dark mode. Same as lightScheme disables the swap. */
  darkScheme: z.string().regex(/^[a-z0-9-]{1,40}$/),
  darkMode: z.object({
    enabled: z.boolean(),
    /** What a first-time visitor gets before they choose. */
    default: z.enum(['light', 'dark', 'system']),
    togglePosition: z.enum(['header', 'footer', 'none']),
  }),
  /** Status colours on light pages. */
  shared: StatusColorsSchema,
  /** Status colours on dark pages. */
  sharedDark: StatusColorsSchema.default(DEFAULT_SHARED_DARK),
  fonts: z.object({
    heading: z.enum(THEME_FONT_IDS),
    body: z.enum(THEME_FONT_IDS),
    headingScale: z.number().min(0.5).max(2),
    bodySizePx: z.number().int().min(12).max(22),
    /** Heading letter spacing in em. */
    headingTracking: z.number().min(-0.05).max(0.1).default(0.01),
  }),
  roundedSections: z.boolean(),
  /** Corner radii and hairline width, in px as the merchant thinks of them. */
  shape: z
    .object({
      buttonRadius: z.number().int().min(0).max(40),
      cardRadius: z.number().int().min(0).max(40),
      inputRadius: z.number().int().min(0).max(40),
      borderWidth: z.number().int().min(0).max(4),
    })
    .default(DEFAULT_SHAPE),
  layout: z
    .object({
      /** Content column width in px. */
      pageWidth: z.number().int().min(960).max(1920),
      /** Multiplier on the section rhythm (the larger spacing steps). */
      sectionSpacing: z.number().min(0.5).max(1.5),
    })
    .default(DEFAULT_LAYOUT),
  buttons: z
    .object({
      style: z.enum(['solid', 'outline']),
      /** `text` keeps Waimers' ink buttons; `brand` paints them in the scheme's brand colour. */
      colour: z.enum(['text', 'brand']),
      uppercase: z.boolean(),
    })
    .default(DEFAULT_BUTTONS),
  cards: z
    .object({
      /** `minimal` drops the card frame and tightens the text under the image. */
      style: z.enum(['standard', 'minimal']).default('standard'),
      imageRatio: z.enum(['square', 'portrait', 'landscape', 'natural']),
      showVendor: z.boolean(),
      showSaleBadge: z.boolean(),
      hoverImage: z.boolean(),
      /** Stars and review count from the Reviews app, when a product has reviews. */
      showRating: z.boolean().default(true),
      /** Quick add on every card (a section can still turn it on for itself). */
      showQuickAdd: z.boolean().default(false),
      showWishlist: z.boolean().default(true),
    })
    .default(DEFAULT_CARDS),
  /** Theme settings → Cart: the drawer or the cart page, and what it shows. */
  cart: z
    .object({
      type: z.enum(['drawer', 'page']),
      /** "Add ₹X more for free shipping", when a shipping rate is free above an amount. */
      freeShippingBar: z.boolean(),
    })
    .default(DEFAULT_CART),
  /** Theme settings → Social media: the store's profiles, used wherever a section shows socials. */
  social: z
    .object({
      links: z
        .array(
          z.object({
            platform: z.enum(SOCIAL_PLATFORMS),
            url: z.string().trim().url().max(300),
          }),
        )
        .max(SOCIAL_PLATFORMS.length),
    })
    .default(() => ({ links: [] })),
  brand: z
    .object({
      logo: MediaRefSchema.nullable(),
      logoWidth: z.number().int().min(60).max(320),
      favicon: MediaRefSchema.nullable(),
    })
    .default(DEFAULT_BRAND),
  /** Theme settings → Custom CSS: the merchant's own rules, after the theme's (native themes). */
  customCss: z.string().max(20_000).default(''),
  /** The preset this theme started from; "Reset to preset" re-applies it. */
  preset: z.enum(THEME_PRESET_IDS).default('waimers'),
  /**
   * Theme editor → Apps: each app embed's switch and settings in this theme, keyed by the
   * embed's `<pluginId>/<Name>`. An embed missing here uses its own default (`app-embeds.ts`).
   */
  appEmbeds: z.record(z.string(), AppEmbedStateSchema).default({}),
})
export type Theme = z.infer<typeof ThemeSchema>

/** Waimers' live Zero Drift configuration, 2026-09. */
export const defaultTheme: Theme = {
  schemes: [
    {
      id: 'scheme-1',
      name: 'White',
      background: '#FFFFFF',
      text: '#1F1F21',
      textMuted: '#6B6B6E',
      line: '#E5E5E5',
      surface: '#FFFFFF',
      button: '#6C3BAA',
      buttonText: '#FFFFFF',
      accent: '#00FCED',
    },
    {
      id: 'scheme-2',
      name: 'Night',
      background: '#101013',
      text: '#F1F1F3',
      textMuted: '#9C9CA6',
      line: '#2C2C33',
      surface: '#1C1C21',
      button: '#A97EE0',
      buttonText: '#101013',
      accent: '#00FCED',
    },
    {
      id: 'scheme-3',
      name: 'Charcoal',
      background: '#1F1F21',
      text: '#FFFFFF',
      textMuted: '#B8B8BE',
      line: '#3A3A3F',
      surface: '#2A2A2F',
      button: '#6C3BAA',
      buttonText: '#FFFFFF',
      accent: '#00FCED',
    },
    {
      id: 'scheme-4',
      name: 'Purple',
      background: '#6C3BAA',
      text: '#FFFFFF',
      textMuted: '#E6DCF5',
      line: '#8A63C2',
      surface: '#7A4BBE',
      button: '#FFFFFF',
      buttonText: '#6C3BAA',
      accent: '#00FCED',
    },
    {
      id: 'scheme-5',
      name: 'Mist',
      background: '#F3F3F3',
      text: '#1F1F21',
      textMuted: '#6B6B6E',
      line: '#E5E5E5',
      surface: '#FFFFFF',
      button: '#6C3BAA',
      buttonText: '#FFFFFF',
      accent: '#00FCED',
    },
  ],
  lightScheme: 'scheme-5',
  darkScheme: 'scheme-3',
  darkMode: { enabled: true, default: 'system', togglePosition: 'header' },
  shared: { success: '#1F9254', danger: '#D2331F', sale: '#6C3BAA' },
  sharedDark: DEFAULT_SHARED_DARK,
  fonts: {
    heading: 'archivo',
    body: 'figtree',
    headingScale: 1,
    bodySizePx: 16,
    headingTracking: 0.01,
  },
  roundedSections: true,
  shape: DEFAULT_SHAPE,
  layout: DEFAULT_LAYOUT,
  buttons: DEFAULT_BUTTONS,
  cards: DEFAULT_CARDS,
  cart: DEFAULT_CART,
  social: { links: [] },
  customCss: '',
  brand: DEFAULT_BRAND,
  preset: 'waimers',
  appEmbeds: {},
}

/** Parse a stored theme, falling back to defaults for anything missing or invalid. */
export function parseTheme(raw: unknown): Theme {
  const r = ThemeSchema.safeParse(raw)
  return r.success ? r.data : defaultTheme
}
