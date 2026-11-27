/**
 * Shared look of the Polish template (Figma "GST invoice templates · Polish",
 * the logo-left frame): neutral greys plus tints of the store's accent colour.
 * The Figma frame is drawn in Indigo #3730a3; every fill there is the accent
 * mixed with white (or white over the accent), so other accents keep the look.
 */
export const INK = '#111827'
export const MUTED = '#6b7280'
export const RULE = '#e5e7eb'

/** Uppercase eyebrow labels track out by a share of their size, as in Figma. */
export const track = (size: number, percent: number) => (size * percent) / 100

const channel = (hex: string, i: number) => Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)

/** `a` moved towards `b` by `t` (0 to 1). Both must be #rrggbb. */
function mix(a: string, b: string, t: number): string {
  const out = [0, 1, 2].map((i) => {
    const v = Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t)
    return v.toString(16).padStart(2, '0')
  })
  return `#${out.join('')}`
}

/** Every accent-derived colour the frame uses, from one accent. */
export function palette(accent: string) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#3730a3'
  const tint = (t: number) => mix('#ffffff', safe, t)
  return {
    accent: safe,
    /** Meta strip and tax breakup head (#f1f1f9 on indigo). */
    strip: tint(0.07),
    /** Party cards and totals box (#f9f9fc). */
    card: tint(0.03),
    /** Item table head (#e3e2f2). */
    head: tint(0.14),
    /** Zebra rows (#fafafd). */
    zebra: tint(0.025),
    /** Seller address on the band (#cdcbe8). */
    onBandSoft: mix(safe, '#ffffff', 0.75),
    /** Title eyebrow on the band (#c3c1e3). */
    onBandFaint: mix(safe, '#ffffff', 0.7),
  }
}
export type Palette = ReturnType<typeof palette>

/**
 * "S&S" style monogram for the logo tile when the store has no logo: the first letters of the
 * first two words joined by "&". Not the admin's avatar `initials` (two plain letters).
 */
export function logoMonogram(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w))
  const letters = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '')
  return letters.join(letters.length === 2 ? '&' : '') || '?'
}
