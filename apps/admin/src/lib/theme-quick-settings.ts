import type { Theme } from '@commerce/core/theme'

/**
 * SOURCE OF TRUTH KEYWORDS: size scale, corner radius, theme quick settings
 * WHAT:  The editor Theme panel's three-way choices (Figma 369:121884): type size S / M / L and
 *        button corners Square / Soft / Round, mapped onto the theme's own numbers.
 * WHY:   The panel shows one simple choice where the theme stores exact values; the exact
 *        sliders stay one click away, so a value in between still shows the nearest choice.
 */

export type SizeScale = 's' | 'm' | 'l'
export type CornerStyle = 'square' | 'soft' | 'round'

export const SIZE_SCALES: Record<SizeScale, Pick<Theme['fonts'], 'headingScale' | 'bodySizePx'>> = {
  s: { headingScale: 0.9, bodySizePx: 15 },
  m: { headingScale: 1, bodySizePx: 16 },
  l: { headingScale: 1.2, bodySizePx: 17 },
}

export const CORNER_RADII: Record<CornerStyle, number> = { square: 0, soft: 8, round: 24 }

/** The size choice nearest the theme's heading scale. */
export function sizeScaleOf(fonts: Pick<Theme['fonts'], 'headingScale'>): SizeScale {
  if (fonts.headingScale < 0.95) return 's'
  if (fonts.headingScale >= 1.1) return 'l'
  return 'm'
}

/** The corner choice nearest the button radius in px. */
export function cornerStyleOf(radius: number): CornerStyle {
  if (radius <= 2) return 'square'
  if (radius >= 16) return 'round'
  return 'soft'
}

/** "1f1f21", "#1F1F21" and "#abc" become "#1F1F21" / "#AABBCC"; anything else is null. */
export function toHex(text: string): string | null {
  const t = text.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(t)) {
    return `#${t
      .split('')
      .map((c) => c + c)
      .join('')}`.toUpperCase()
  }
  return /^[0-9a-f]{6}$/i.test(t) ? `#${t}`.toUpperCase() : null
}
