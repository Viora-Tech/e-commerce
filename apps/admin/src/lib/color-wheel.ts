/** Hue/saturation/value ⇄ `#rrggbb`, for the accent colour wheel (Appearance). */

export type Hsv = { h: number; s: number; v: number }

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n))

export function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  const to = (x: number) =>
    Math.round(clamp(x) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to(f(5))}${to(f(3))}${to(f(1))}`
}

export function hexToHsv(hex: string): Hsv {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m?.[1]) return { h: 0, s: 0, v: 0 }
  const n = Number.parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max ? d / max : 0, v: max }
}

/**
 * A point on the wheel (relative to its centre, in units of its radius) → hue and saturation.
 * Hue 0 (red) is at the top and runs clockwise, like the conic gradient that draws it.
 */
export function wheelPoint(x: number, y: number): { h: number; s: number } {
  const angle = (Math.atan2(x, -y) * 180) / Math.PI
  return { h: (angle + 360) % 360, s: clamp(Math.hypot(x, y)) }
}

/** Where a hue and saturation sit on the wheel, as percentages of its box (for the handle). */
export function wheelPosition(h: number, s: number): { left: number; top: number } {
  const rad = (h * Math.PI) / 180
  return { left: 50 + Math.sin(rad) * s * 50, top: 50 - Math.cos(rad) * s * 50 }
}
