import { type Rgb01, readCssColorVar } from '@/lib/cobe-colors'

export type GlobePalette = {
  base: Rgb01
  marker: Rgb01
  glow: Rgb01
  arc: Rgb01
  arcNewest: Rgb01
}

/** Globe colours as `[0,0,0]`..`[1,1,1]`, read from the tokens the whole dashboard uses (so
 * the merchant's accent and the light/dark theme both apply). Shared by both globes. */
export function readPalette(dark: boolean): GlobePalette {
  const fallbackBase: Rgb01 = dark ? [0.45, 0.45, 0.47] : [0.6, 0.6, 0.62]
  const fallbackPrimary: Rgb01 = dark ? [0.19, 0.82, 0.34] : [0.31, 0.65, 0.46]
  return {
    base: readCssColorVar('--muted-foreground', fallbackBase),
    marker: readCssColorVar('--primary', fallbackPrimary),
    glow: readCssColorVar('--primary', fallbackPrimary),
    arc: readCssColorVar('--primary', fallbackPrimary),
    arcNewest: readCssColorVar('--chart-2', fallbackPrimary),
  }
}
