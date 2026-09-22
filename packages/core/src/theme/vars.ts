import { fontStack } from './fonts'
import type { ColorScheme, StatusColors, Theme } from './schema'

export type ThemeVarMode = 'light' | 'dark'
export type CssVars = Record<string, string>

const rem = (px: number): string => `${Number((px / 16).toFixed(4))}rem`

/** The eight colour roles of one scheme, as the custom properties the blocks read. */
export function schemeVars(s: ColorScheme): CssVars {
  return {
    '--color-bg': s.background,
    '--color-ink': s.text,
    '--color-muted': s.textMuted,
    '--color-line': s.line,
    '--color-surface': s.surface,
    '--color-brand': s.button,
    '--color-on-brand': s.buttonText,
    '--color-accent': s.accent,
    '--color-accent-2': s.accent,
    // The always-dark band: a constant, not a derivation (see Glide's css-variables).
    '--color-dark-band': s.text,
    '--color-on-dark-band': s.background,
  }
}

/** The scheme a page in `mode` paints with. Dark falls back to light when dark mode is off. */
export function schemeFor(theme: Theme, mode: ThemeVarMode): ColorScheme {
  const id = mode === 'dark' && theme.darkMode.enabled ? theme.darkScheme : theme.lightScheme
  const found = theme.schemes.find((s) => s.id === id) ?? theme.schemes[0]
  if (!found) throw new Error('theme has no schemes')
  return found
}

function statusFor(theme: Theme, mode: ThemeVarMode): StatusColors {
  return mode === 'dark' && theme.darkMode.enabled ? theme.sharedDark : theme.shared
}

/** Everything that changes between light and dark pages. */
export function themeColorVars(theme: Theme, mode: ThemeVarMode): CssVars {
  const status = statusFor(theme, mode)
  return {
    ...schemeVars(schemeFor(theme, mode)),
    '--color-success': status.success,
    '--color-danger': status.danger,
    '--color-sale': status.sale,
  }
}

const CARD_RATIO: Record<Theme['cards']['imageRatio'], string> = {
  square: '1 / 1',
  portrait: '4 / 5',
  landscape: '4 / 3',
  natural: 'auto',
}

/** The section rhythm steps (40, 48, 64, 80px) that "section spacing" scales. */
const SECTION_STEPS = { '--space-7': 40, '--space-8': 48, '--space-9': 64, '--space-10': 80 }

/** Everything that is the same on light and dark pages. */
export function themeLayoutVars(theme: Theme): CssVars {
  const { fonts, shape, layout, buttons, cards, brand } = theme
  const brandButtons = buttons.colour === 'brand'
  const vars: CssVars = {
    '--font-heading': fontStack(fonts.heading),
    '--font-body': fontStack(fonts.body),
    '--font-heading-scale': String(fonts.headingScale),
    '--font-body-size': rem(fonts.bodySizePx),
    '--heading-tracking': `${fonts.headingTracking}em`,
    '--section-radius': theme.roundedSections ? 'clamp(1rem, 1.578vw, 1.875rem)' : '0rem',
    '--radius-button': rem(shape.buttonRadius),
    '--radius-card': rem(shape.cardRadius),
    '--radius-input': rem(shape.inputRadius),
    '--border-width': rem(shape.borderWidth),
    '--page-width': rem(layout.pageWidth),
    '--btn-bg': brandButtons ? 'var(--color-brand)' : 'var(--color-ink)',
    '--btn-text': brandButtons ? 'var(--color-on-brand)' : 'var(--color-bg)',
    '--btn-transform': buttons.uppercase ? 'uppercase' : 'none',
    '--card-ratio': CARD_RATIO[cards.imageRatio],
    '--logo-width': rem(brand.logoWidth),
  }
  for (const [name, px] of Object.entries(SECTION_STEPS)) {
    vars[name] = rem(px * layout.sectionSpacing)
  }
  return vars
}

/** Every custom property a page in `mode` needs; what the live preview applies. */
export function themeToCssVars(theme: Theme, mode: ThemeVarMode): CssVars {
  return { ...themeLayoutVars(theme), ...themeColorVars(theme, mode) }
}

/**
 * Switches that are not values: set as data attributes on <html> so the block CSS
 * can hide the vendor line or draw outline buttons, and so the preview can flip
 * them without re-rendering the page.
 */
export function themeRootAttrs(theme: Theme): Record<string, string> {
  return {
    'data-button-style': theme.buttons.style,
    'data-card-vendor': theme.cards.showVendor ? 'on' : 'off',
    'data-card-sale-badge': theme.cards.showSaleBadge ? 'on' : 'off',
    'data-card-hover': theme.cards.hoverImage ? 'on' : 'off',
    'data-card-ratio': theme.cards.imageRatio,
  }
}

/** `a:b;c:d` for a style block. */
export function cssVarsToDeclarations(vars: CssVars): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')
}

// --- Contrast ---------------------------------------------------------------

function channel(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  )
}

/** WCAG 2 contrast ratio between two #RRGGBB colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** WCAG AA for body text. */
export const AA_TEXT = 4.5

export type ContrastPair = 'text' | 'muted' | 'surface' | 'onBrand' | 'button' | 'sale'

export type ContrastWarning = {
  mode: ThemeVarMode
  pair: ContrastPair
  foreground: string
  background: string
  ratio: number
}

/** The text/background pairs a store will actually render, and the ones that fail AA. */
export function themeContrastWarnings(theme: Theme): ContrastWarning[] {
  const modes: ThemeVarMode[] = theme.darkMode.enabled ? ['light', 'dark'] : ['light']
  const out: ContrastWarning[] = []
  for (const mode of modes) {
    const s = schemeFor(theme, mode)
    const status = statusFor(theme, mode)
    const pairs: [ContrastPair, string, string][] = [
      ['text', s.text, s.background],
      ['muted', s.textMuted, s.background],
      ['surface', s.text, s.surface],
      ['onBrand', s.buttonText, s.button],
      ['sale', s.background, status.sale],
    ]
    // Ink buttons invert the page colours; brand buttons are already the onBrand pair.
    if (theme.buttons.colour === 'text') pairs.push(['button', s.background, s.text])
    for (const [pair, foreground, background] of pairs) {
      const ratio = contrastRatio(foreground, background)
      if (ratio < AA_TEXT) out.push({ mode, pair, foreground, background, ratio })
    }
  }
  return out
}
