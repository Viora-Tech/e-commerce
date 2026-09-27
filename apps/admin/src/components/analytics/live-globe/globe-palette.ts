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
}

/** Fixed land/ocean/accent colours for the non-"Store accent" theme presets — chosen to read
 * well in both light and dark mode (the WebGL globe still brightens land a little more in dark
 * mode on top of these, same as the default theme always has). */
const THEME_COLORS: Record<Exclude<GlobeThemePreset, 'accent'>, { land: Rgb01; ocean: Rgb01; accent: Rgb01 }> = {
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
export function readPalette(dark: boolean, look?: GlobeLookColors): GlobePalette {
  const fallbackBase: Rgb01 = dark ? [0.45, 0.45, 0.47] : [0.6, 0.6, 0.62]
  const fallbackPrimary: Rgb01 = dark ? [0.19, 0.82, 0.34] : [0.31, 0.65, 0.46]
  const theme = look?.theme ?? 'accent'
  // "Store accent" keeps the original look exactly: one base colour the shader shades into
  // both ocean and land (see `globe-renderer.ts`), not a separate flat ocean tint.
  const [base, ocean, accent]: [Rgb01, Rgb01, Rgb01] =
    theme === 'accent'
      ? [
          readCssColorVar('--muted-foreground', fallbackBase),
          readCssColorVar('--muted-foreground', fallbackBase),
          readCssColorVar('--primary', fallbackPrimary),
        ]
      : [THEME_COLORS[theme].land, THEME_COLORS[theme].ocean, THEME_COLORS[theme].accent]

  return {
    base: hexToRgb01(look?.customLand ?? '') ?? base,
    ocean: hexToRgb01(look?.customOcean ?? '') ?? ocean,
    marker: hexToRgb01(look?.customAccent ?? '') ?? accent,
    glow: hexToRgb01(look?.customAccent ?? '') ?? accent,
    arc: hexToRgb01(look?.customAccent ?? '') ?? accent,
    arcNewest:
      theme === 'accent' ? readCssColorVar('--chart-2', fallbackPrimary) : hexToRgb01(look?.customAccent ?? '') ?? accent,
  }
}
