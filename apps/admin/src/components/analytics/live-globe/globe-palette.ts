import { hexToRgb01, type Rgb01, readCssColorVar } from '@/lib/cobe-colors'
import type { GlobeThemePreset } from './globe-settings'

export type GlobePalette = {
  /** Land colour (the WebGL globe's `C` uniform). */
  base: Rgb01
  /** Ocean colour (the WebGL globe's `O` uniform). */
  ocean: Rgb01
  marker: Rgb01
  glow: Rgb01
  arc: Rgb01
  arcNewest: Rgb01
  /** "Border style: Dotted"'s dot colour: the same subtle tint as the shader's own solid
   * border line (`globe-renderer.ts`'s `line`), computed the same way from `base`. */
  borderDot: Rgb01
  /** The cobe-style dotted land's colour (`GlobeFrame.cobeDots.color`): cobe's `baseColor` in
   * dark mode (a deep tone the shader brightens about 4.5x, so the dots come out roughly the
   * nominal land colour), the dots' ink in light mode. */
  dotColor: Rgb01
  /** The sprite-dotted land's colour (`GlobeFrame.spriteDots.color`), drawn as is: the colour
   * the land reads as (the theme's or the picked land colour; in dark mode with "Store accent",
   * the accent), never brightened past it, so dots stay in the palette instead of going white. */
  landDot: Rgb01
  /** What the settings panel's colour pickers show when no custom colour is set: roughly the
   * colour actually seen on the globe (land dots, the sea at the centre, the accent). */
  swatches: { land: string; ocean: string; accent: string }
}

/** The Home globe's deep tone in dark mode (Figma 227:549): the primary at about a third. In
 * light mode the neutral primary is near-black, so the globe uses the muted ink instead. */
function deep(c: Rgb01): Rgb01 {
  return c.map((v) => v * 0.38) as Rgb01
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/** `deep()` undone, clamped: a dark-mode dot colour back to the colour it reads as. */
function lift(c: Rgb01): Rgb01 {
  return c.map((v) => clamp01(v / 0.38)) as Rgb01
}

function toHex(c: Rgb01): string {
  return `#${c
    .map((v) =>
      Math.round(clamp01(v) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

/** The sea's lit share at the centre of the disc (the WebGL globe's `sea` in
 * `globe-renderer.ts`): a tenth in dark mode, 1.1x in light. A custom ocean colour is divided
 * by this, so the sea comes out as the picked colour. */
function seaGain(dark: boolean): number {
  return dark ? 0.1 : 1.1
}

/** Fixed land/ocean/accent colours for the non-"Store accent" theme presets — chosen to read
 * well in both light and dark mode (the WebGL globe still brightens land a little more in dark
 * mode on top of these, same as the default theme always has). */
const THEME_COLORS: Record<
  Exclude<GlobeThemePreset, 'accent'>,
  { land: Rgb01; ocean: Rgb01; accent: Rgb01 }
> = {
  night: { land: [0.16, 0.19, 0.28], ocean: [0.04, 0.05, 0.1], accent: [0.42, 0.74, 0.98] },
  ocean: { land: [0.42, 0.5, 0.42], ocean: [0.06, 0.22, 0.4], accent: [0.35, 0.78, 0.92] },
  mono: { land: [0.5, 0.5, 0.5], ocean: [0.14, 0.14, 0.14], accent: [0.85, 0.85, 0.85] },
}

export type GlobeLookColors = {
  theme: GlobeThemePreset
  customLand: string | null
  customOcean: string | null
  customAccent: string | null
}

/** Globe colours as `[0,0,0]`..`[1,1,1]`. "Store accent" (the default) reads the tokens the
 * whole dashboard uses, so the merchant's accent and the light/dark theme both apply; the other
 * presets are fixed colours, overridable per-channel by the custom pickers. Shared by both
 * globes (the cobe Home card always calls this with no `look`, i.e. "Store accent"). */
export function readPalette(dark: boolean, look?: GlobeLookColors, brand = false): GlobePalette {
  const fallbackBase: Rgb01 = dark ? [0.45, 0.45, 0.47] : [0.6, 0.6, 0.62]
  const fallbackPrimary: Rgb01 = dark ? [0.19, 0.82, 0.34] : [0.31, 0.65, 0.46]
  const theme = look?.theme ?? 'accent'
  // "Store accent" keeps the original look exactly: one base colour the shader shades into
  // both ocean and land (see `globe-renderer.ts`), not a separate flat ocean tint.
  const [base, ocean, accent]: [Rgb01, Rgb01, Rgb01] =
    theme === 'accent'
      ? [
          brand && dark
            ? deep(readCssColorVar('--primary', fallbackPrimary))
            : readCssColorVar('--muted-foreground', fallbackBase),
          brand && dark
            ? deep(readCssColorVar('--primary', fallbackPrimary))
            : readCssColorVar('--muted-foreground', fallbackBase),
          readCssColorVar('--primary', fallbackPrimary),
        ]
      : [THEME_COLORS[theme].land, THEME_COLORS[theme].ocean, THEME_COLORS[theme].accent]

  const customLand = hexToRgb01(look?.customLand ?? '')
  const customOcean = hexToRgb01(look?.customOcean ?? '')
  const resolvedBase = customLand ?? base
  // Dark: cobe's deep base (the Home card's "Store accent" is already deep); light: the ink
  // cobe's light mode shades its dots towards (a tenth of the base), or the picked colour.
  const alreadyDeep = theme === 'accent' && brand && dark && !customLand
  const dotColor: Rgb01 = dark
    ? alreadyDeep
      ? resolvedBase
      : deep(resolvedBase)
    : theme === 'accent' && !customLand
      ? (resolvedBase.map((c) => c * 0.1) as Rgb01)
      : resolvedBase
  /* Dark "Store accent" lifts the deep accent back to the accent itself; the default neutral
     accent is near-white there, so it is softened to a light grey like the Home card's dots
     read on average. A picked or preset land colour is used exactly. */
  const landDot: Rgb01 = dark
    ? alreadyDeep
      ? (lift(dotColor).map((c) => c * 0.8) as Rgb01)
      : lift(dotColor)
    : dotColor
  const resolvedOcean = customOcean ? (customOcean.map((c) => c / seaGain(dark)) as Rgb01) : ocean
  const resolvedAccent = hexToRgb01(look?.customAccent ?? '') ?? accent
  const borderDot: Rgb01 = dark
    ? (resolvedBase.map((c) => clamp01(c * 2.3 + 0.2)) as Rgb01)
    : (resolvedBase.map((c) => clamp01(c * 1.25 + 0.12)) as Rgb01)

  return {
    base: resolvedBase,
    ocean: resolvedOcean,
    marker: resolvedAccent,
    glow: resolvedAccent,
    arc: resolvedAccent,
    arcNewest: theme === 'accent' ? readCssColorVar('--chart-2', fallbackPrimary) : resolvedAccent,
    borderDot,
    dotColor,
    landDot,
    swatches: {
      land: toHex(landDot),
      ocean: toHex(resolvedOcean.map((c) => c * seaGain(dark)) as Rgb01),
      accent: toHex(resolvedAccent),
    },
  }
}
