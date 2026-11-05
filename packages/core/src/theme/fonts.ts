/**
 * The typefaces a store can choose. Curated rather than open-ended: every one is
 * self-hosted by the storefront through next/font, so choosing one never adds a
 * request to fonts.googleapis.com for shoppers.
 */
export const THEME_FONT_IDS = [
  'archivo',
  'figtree',
  'geist',
  'inter',
  'manrope',
  'dm-sans',
  'plus-jakarta-sans',
  'space-grotesk',
  'sora',
  'outfit',
  'lexend',
  'work-sans',
  'ibm-plex-sans',
  'playfair-display',
  'fraunces',
  'lora',
  'instrument-serif',
] as const

export type ThemeFontId = (typeof THEME_FONT_IDS)[number]

export type ThemeFont = {
  label: string
  category: 'sans' | 'serif'
  /** Google Fonts family query, used by the admin to render picker samples. */
  google: string
}

export const THEME_FONTS: Record<ThemeFontId, ThemeFont> = {
  archivo: { label: 'Archivo', category: 'sans', google: 'Archivo:wght@400;500;600;700' },
  figtree: { label: 'Figtree', category: 'sans', google: 'Figtree:wght@400;500;600;700' },
  geist: { label: 'Geist', category: 'sans', google: 'Geist:wght@400;500;600;700' },
  inter: { label: 'Inter', category: 'sans', google: 'Inter:wght@400;500;600;700' },
  manrope: { label: 'Manrope', category: 'sans', google: 'Manrope:wght@400;500;600;700' },
  'dm-sans': { label: 'DM Sans', category: 'sans', google: 'DM+Sans:wght@400;500;600;700' },
  'plus-jakarta-sans': {
    label: 'Plus Jakarta Sans',
    category: 'sans',
    google: 'Plus+Jakarta+Sans:wght@400;500;600;700',
  },
  'space-grotesk': {
    label: 'Space Grotesk',
    category: 'sans',
    google: 'Space+Grotesk:wght@400;500;600;700',
  },
  sora: { label: 'Sora', category: 'sans', google: 'Sora:wght@400;500;600;700' },
  outfit: { label: 'Outfit', category: 'sans', google: 'Outfit:wght@400;500;600;700' },
  lexend: { label: 'Lexend', category: 'sans', google: 'Lexend:wght@400;500;600;700' },
  'work-sans': { label: 'Work Sans', category: 'sans', google: 'Work+Sans:wght@400;500;600;700' },
  'ibm-plex-sans': {
    label: 'IBM Plex Sans',
    category: 'sans',
    google: 'IBM+Plex+Sans:wght@400;500;600;700',
  },
  'playfair-display': {
    label: 'Playfair Display',
    category: 'serif',
    google: 'Playfair+Display:wght@400;500;600;700',
  },
  fraunces: { label: 'Fraunces', category: 'serif', google: 'Fraunces:wght@400;500;600;700' },
  lora: { label: 'Lora', category: 'serif', google: 'Lora:wght@400;500;600;700' },
  'instrument-serif': {
    label: 'Instrument Serif',
    category: 'serif',
    google: 'Instrument+Serif',
  },
}

/** Heading and body combinations that are known to work, offered as one-click picks. */
export const FONT_PAIRINGS: { id: string; heading: ThemeFontId; body: ThemeFontId }[] = [
  { id: 'archivo-figtree', heading: 'archivo', body: 'figtree' },
  { id: 'inter-inter', heading: 'inter', body: 'inter' },
  { id: 'space-grotesk-inter', heading: 'space-grotesk', body: 'inter' },
  { id: 'sora-manrope', heading: 'sora', body: 'manrope' },
  { id: 'outfit-dm-sans', heading: 'outfit', body: 'dm-sans' },
  { id: 'plus-jakarta-sans-inter', heading: 'plus-jakarta-sans', body: 'inter' },
  { id: 'lexend-work-sans', heading: 'lexend', body: 'work-sans' },
  { id: 'ibm-plex-sans-ibm-plex-sans', heading: 'ibm-plex-sans', body: 'ibm-plex-sans' },
  { id: 'manrope-manrope', heading: 'manrope', body: 'manrope' },
  { id: 'dm-sans-dm-sans', heading: 'dm-sans', body: 'dm-sans' },
  { id: 'playfair-display-inter', heading: 'playfair-display', body: 'inter' },
  { id: 'fraunces-dm-sans', heading: 'fraunces', body: 'dm-sans' },
  { id: 'lora-work-sans', heading: 'lora', body: 'work-sans' },
  { id: 'instrument-serif-inter', heading: 'instrument-serif', body: 'inter' },
  { id: 'playfair-display-lora', heading: 'playfair-display', body: 'lora' },
  { id: 'fraunces-figtree', heading: 'fraunces', body: 'figtree' },
]

/** The CSS custom property the storefront's next/font instance defines for a font. */
export function fontVariable(id: ThemeFontId): string {
  return `--font-${id}`
}

/**
 * A font-family value that resolves through the storefront's self-hosted face and
 * falls back to the family name, then the generic category. Where the variable is
 * not defined (the admin page editor frame) this behaves exactly like naming the
 * family directly.
 */
export function fontStack(id: ThemeFontId): string {
  const f = THEME_FONTS[id]
  return `var(${fontVariable(id)}, "${f.label}"), ${f.category === 'serif' ? 'serif' : 'sans-serif'}`
}
