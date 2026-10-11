/**
 * Admin accent colour: one merchant-chosen hex becomes every brand token the admin reads
 * (`--primary`, its foreground, soft and tint surfaces, focus ring, first chart series) for
 * light and dark mode. Browser-safe: the settings page runs it for the live preview and the
 * server layout runs it to inject the override before paint.
 *
 * Approach from tweakcn (github.com/jnsahaj/tweakcn, Apache-2.0): derive a whole shadcn
 * palette from one seed in OKLCH and expose a row of preset swatches. The code here is ours.
 */
import { AA_TEXT, contrastRatio } from '../theme/vars'

/**
 * Proofly blue, the stylesheet's own `--primary` (packages/ui/src/styles.css, the "Proofly look"
 * chosen 2026-10-09). Choosing it means "no override". It used to be the Figma kit's Ocean Green;
 * after the stylesheet moved to blue, picking green fell through to the blue default.
 */
export const DEFAULT_ACCENT = '#3f72dc'

/** Ocean Green, the earlier Figma kit primary: now an ordinary preset that overrides. */
export const OCEAN_GREEN = '#4ea674'

export type AccentPreset = { id: string; hex: string }

/** Swatches on Settings › Appearance, default first. */
export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'proofly-blue', hex: DEFAULT_ACCENT },
  { id: 'ocean-green', hex: OCEAN_GREEN },
  { id: 'blue', hex: '#2563eb' },
  { id: 'indigo', hex: '#4f46e5' },
  { id: 'violet', hex: '#7c3aed' },
  { id: 'rose', hex: '#e11d48' },
  { id: 'orange', hex: '#ea580c' },
  { id: 'amber', hex: '#d97706' },
  { id: 'slate', hex: '#475569' },
]

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/**
 * `#RRGGBB` lower case for a valid 3 or 6 digit hex (hash optional), otherwise null.
 * Anything else, including CSS that could break out of a style block, is refused.
 */
export function normaliseAccent(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const m = HEX.exec(value.trim())
  if (!m?.[1]) return null
  const digits = m[1].toLowerCase()
  const six = digits.length === 3 ? [...digits].map((c) => c + c).join('') : digits
  return `#${six}`
}

/** A stored or submitted accent, or null when it is invalid or the default (no override needed). */
export function accentOverride(value: unknown): string | null {
  const hex = normaliseAccent(value)
  return hex && hex !== DEFAULT_ACCENT ? hex : null
}

// --- OKLCH ----------------------------------------------------------------------------------

type Oklch = { l: number; c: number; h: number }

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** sRGB hex to OKLCH (Björn Ottosson's OKLab matrices). */
export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const h = (Math.atan2(B, A) * 180) / Math.PI
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h }
}

/** Linear sRGB for an OKLCH colour; may fall outside 0..1 when out of gamut. */
function oklchToLinear({ l: L, c, h }: Oklch): [number, number, number] {
  const A = c * Math.cos((h * Math.PI) / 180)
  const B = c * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4)

/** OKLCH to hex, pulling chroma in (hue and lightness kept) until it fits sRGB. */
export function oklchToHex(color: Oklch): string {
  let rgb = oklchToLinear(color)
  if (!inGamut(rgb)) {
    let lo = 0
    let hi = color.c
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (inGamut(oklchToLinear({ ...color, c: mid }))) lo = mid
      else hi = mid
    }
    rgb = oklchToLinear({ ...color, c: lo })
  }
  const byte = (v: number) =>
    Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, v))))) * 255)
  return `#${rgb.map((v) => byte(v).toString(16).padStart(2, '0')).join('')}`
}

// --- Tokens ---------------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Text colour for a filled accent surface: white when it reaches WCAG AA (4.5:1), else
 * whichever of white and a near-black tinted with the accent's hue contrasts more.
 */
export function accentForeground(background: string): string {
  const white = '#ffffff'
  const { h, c } = hexToOklch(background)
  const ink = oklchToHex({ l: 0.2, c: Math.min(c, 0.03), h })
  const onWhite = contrastRatio(white, background)
  if (onWhite >= AA_TEXT) return white
  return contrastRatio(ink, background) > onWhite ? ink : white
}

export type AccentTokens = {
  primary: string
  primaryForeground: string
  primarySoft: string
  primaryTint: string
}

export type AccentPalette = { light: AccentTokens; dark: AccentTokens }

/**
 * The default (Proofly blue) exactly as the stylesheet sets it (`packages/ui/src/styles.css`), so the
 * preview of the default matches the real admin rather than a derived palette.
 */
export const KIT_PALETTE: AccentPalette = {
  light: {
    primary: DEFAULT_ACCENT,
    primaryForeground: '#ffffff',
    primarySoft: '#eaf1fd',
    primaryTint: '#eaf1fd',
  },
  dark: {
    primary: '#7fa2f5',
    primaryForeground: '#0e1430',
    primarySoft: '#1f283d',
    primaryTint: '#1f283d',
  },
}

/**
 * The brand tokens for both modes. Light keeps the chosen colour as-is; dark lifts it to
 * OKLCH lightness 0.62..0.82 so it reads on the dark canvas, like the kit's #5fbf87 for
 * #4ea674. Soft and tint surfaces keep the hue at low chroma, matching Aqua Spring and
 * Surf Crest for the default.
 */
export function deriveAccentPalette(hex: string): AccentPalette {
  if (hex === DEFAULT_ACCENT) return KIT_PALETTE
  const base = hexToOklch(hex)
  const darkPrimary = oklchToHex({ ...base, l: clamp(base.l + 0.07, 0.62, 0.82) })
  const [r, g, b] = hexToRgb(hex).map((v) => Math.round(v * 255))
  return {
    light: {
      primary: hex,
      primaryForeground: accentForeground(hex),
      primarySoft: oklchToHex({ l: 0.965, c: Math.min(base.c * 0.25, 0.035), h: base.h }),
      primaryTint: oklchToHex({ l: 0.89, c: Math.min(base.c * 0.55, 0.07), h: base.h }),
    },
    dark: {
      primary: darkPrimary,
      primaryForeground: accentForeground(darkPrimary),
      primarySoft: `rgb(${r} ${g} ${b} / 0.16)`,
      primaryTint: oklchToHex({ l: 0.42, c: Math.min(base.c * 0.6, 0.08), h: base.h }),
    },
  }
}

/** Custom properties for one mode, as `name: value` pairs. */
export function accentVars(t: AccentTokens): Record<string, string> {
  return {
    '--primary': t.primary,
    '--primary-foreground': t.primaryForeground,
    '--primary-soft': t.primarySoft,
    '--primary-tint': t.primaryTint,
    '--ring': t.primary,
    '--chart-1': t.primary,
  }
}

/**
 * The Proofly look draws its blue from more than `--primary`: the key buttons (`--key-*`), the
 * active nav pill, soft accent fills, links and the next-step banner wash. These follow the
 * chosen accent too, mixed from it in CSS so light and dark keep the stylesheet's recipe.
 */
export function designVars(t: AccentTokens, mode: 'light' | 'dark'): Record<string, string> {
  const p = t.primary
  const tint = (pct: number, over: string) => `color-mix(in oklab, ${p} ${pct}%, ${over})`
  const alpha = (pct: number) => `color-mix(in oklab, ${p} ${pct}%, transparent)`
  const shared = {
    '--brand-wash': alpha(mode === 'light' ? 10 : 6),
    '--brand-wash-end': mode === 'light' ? alpha(10) : alpha(0),
    '--brand-border': alpha(30),
  }
  if (mode === 'light') {
    const ink = tint(85, 'black')
    return {
      ...shared,
      '--key-top': tint(10, 'white'),
      '--key-bottom': tint(21, 'white'),
      '--key-border': tint(36, 'white'),
      '--key-edge': alpha(32),
      '--key-glow': alpha(38),
      '--key-ink': ink,
      '--brand-select': tint(11, 'white'),
      '--accent': tint(11, 'white'),
      '--accent-foreground': ink,
      '--sidebar-accent': tint(11, 'white'),
      '--sidebar-accent-foreground': ink,
      '--link': ink,
    }
  }
  const soft = tint(22, '#101216')
  const ink = tint(55, 'white')
  return {
    ...shared,
    '--key-top': p,
    '--key-bottom': tint(85, 'black'),
    '--key-border': alpha(60),
    '--key-glow': alpha(55),
    '--key-ink': '#ffffff',
    '--brand-select': alpha(6),
    '--accent': soft,
    '--accent-foreground': ink,
    '--sidebar-accent': soft,
    '--sidebar-accent-foreground': ink,
    '--link': ink,
  }
}

const declarations = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')

/**
 * The override style block for a stored accent, or '' when there is nothing to override
 * (no choice, the default, or an invalid value). Page-wide, `:root:root` and `:root.dark`
 * outrank the stylesheet's `:root` and `.dark` whatever order the two load in; the sidebar
 * tokens alias `--primary` and `--ring`, so they follow. With `scope` (a selector such as
 * `#accent-preview`) only that subtree is recoloured, for the settings page preview; there
 * the default is written out too, since the page around it may carry another accent.
 */
export function accentCss(value: unknown, scope?: string): string {
  const hex = scope ? normaliseAccent(value) : accentOverride(value)
  if (!hex) return ''
  const p = deriveAccentPalette(hex)
  const light = declarations({ ...accentVars(p.light), ...designVars(p.light, 'light') })
  const dark = declarations({ ...accentVars(p.dark), ...designVars(p.dark, 'dark') })
  return scope
    ? `${scope}{${light}}.dark ${scope}{${dark}}`
    : `:root:root{${light}}:root.dark{${dark}}`
}

// --- Cookie ---------------------------------------------------------------------------------

/**
 * First-paint cache of the accent the signed-in member sees in one store, keyed by the
 * store's organization id (the session names it), so the admin layout can inject the
 * override without a query. The database stays the source of truth: the cookie is
 * short-lived and rewritten from it, so a store default the owner changes reaches members
 * within `ACCENT_COOKIE_MAX_AGE` seconds.
 */
export const ACCENT_COOKIE = 'admin-accent'
export const ACCENT_COOKIE_MAX_AGE = 60 * 10

/** `<organizationId>~<hex without #|default>`. */
export function accentCookieValue(scopeId: string, value: unknown): string {
  return `${scopeId}~${accentOverride(value)?.slice(1) ?? 'default'}`
}

/**
 * The cached accent for `scopeId`: a hex, null for the default, or undefined when the
 * cookie is missing, for another store or malformed (the caller then reads the database).
 */
export function readAccentCookie(
  raw: string | undefined,
  scopeId: string,
): string | null | undefined {
  if (!raw) return undefined
  const [id, value, ...rest] = raw.split('~')
  if (rest.length > 0 || id !== scopeId || !value) return undefined
  if (value === 'default') return null
  return accentOverride(value) ?? undefined
}
