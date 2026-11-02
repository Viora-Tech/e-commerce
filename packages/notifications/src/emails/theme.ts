import type { EmailBrandInfo } from '../types'

/**
 * Shared visual tokens for every email (owner, 3 Nov 2026: the "Brand" look, Plus Jakarta Sans,
 * centred buttons, flat colours only). Email clients strip <style> and CSS variables in most
 * inboxes, so every value here is a literal used directly in inline styles.
 */
export const theme = {
  page: '#ffffff',
  panel: '#f6f5f2',
  ink: '#161615',
  body: '#55534d',
  muted: '#8a8882',
  faint: '#a3a19a',
  border: '#eeede9',
  footer: '#161615',
  footerText: '#b5b2aa',
  /** The brand colour when the store has none (platform emails, tests). */
  brand: '#161615',
  onBrand: '#ffffff',
  fontFamily:
    "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} as const

const HEX = /^#[0-9a-f]{6}$/i

/** The store's brand colour and the text colour on it, falling back to ink on white. */
export function brandColours(brand: EmailBrandInfo | undefined): { bg: string; fg: string } {
  const bg = brand?.colour && HEX.test(brand.colour) ? brand.colour : theme.brand
  const fg = brand?.onColour && HEX.test(brand.onColour) ? brand.onColour : theme.onBrand
  // A near-white brand colour would vanish on the white page: use ink instead.
  return luminance(bg) > 0.85 ? { bg: theme.brand, fg: theme.onBrand } : { bg, fg }
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}
