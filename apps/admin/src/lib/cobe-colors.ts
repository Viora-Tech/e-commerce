/** cobe wants colours as `[r, g, b]` floats from 0 to 1, not CSS strings. */
export type Rgb01 = [number, number, number]

/** "#30d158" (3 or 6 hex digits, `#` optional) -> `[r, g, b]` 0-1; null when it does not parse. */
export function hexToRgb01(hex: string): Rgb01 | null {
  const cleaned = hex.trim().replace(/^#/, '')
  const full =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  const r = Number.parseInt(full.slice(0, 2), 16) / 255
  const g = Number.parseInt(full.slice(2, 4), 16) / 255
  const b = Number.parseInt(full.slice(4, 6), 16) / 255
  return [r, g, b]
}

/**
 * A CSS custom property's live, computed value (so the merchant's chosen `--primary` accent
 * and light/dark theme overrides both apply) as a cobe colour. Falls back when the browser
 * cannot resolve it yet (SSR, or the property is unset).
 */
export function readCssColorVar(name: string, fallback: Rgb01): Rgb01 {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name)
  return hexToRgb01(value) ?? fallback
}
