import { z } from 'zod'

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'hex colour like #1F1F21')

/** One colour scheme, same roles as Glide's color_scheme_group. */
export const ColorSchemeSchema = z.object({
  id: z.string().min(1),
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

export const ThemeSchema = z.object({
  schemes: z.array(ColorSchemeSchema).min(1),
  /** Scheme id used on light pages. */
  lightScheme: z.string().min(1),
  /** Scheme id swapped in for dark mode. Same as lightScheme disables the swap. */
  darkScheme: z.string().min(1),
  darkMode: z.object({
    enabled: z.boolean(),
    /** What a first-time visitor gets before they choose. */
    default: z.enum(['light', 'dark', 'system']),
    togglePosition: z.enum(['header', 'footer', 'none']),
  }),
  shared: z.object({ success: hex, danger: hex }),
  fonts: z.object({
    heading: z.enum(['archivo', 'figtree']),
    body: z.enum(['archivo', 'figtree']),
    headingScale: z.number().min(0.5).max(2),
    bodySizePx: z.number().int().min(12).max(22),
  }),
  roundedSections: z.boolean(),
})
export type Theme = z.infer<typeof ThemeSchema>

/** Waimers' live Glide configuration, 2026-09. */
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
  shared: { success: '#1F9254', danger: '#D2331F' },
  fonts: { heading: 'archivo', body: 'figtree', headingScale: 1, bodySizePx: 16 },
  roundedSections: true,
}

/** Parse a stored theme, falling back to defaults for anything missing or invalid. */
export function parseTheme(raw: unknown): Theme {
  const r = ThemeSchema.safeParse(raw)
  return r.success ? r.data : defaultTheme
}
