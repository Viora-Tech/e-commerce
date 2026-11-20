import type { EmailBrandInfo } from '../types'

/**
 * Shared visual tokens for every email (owner, 19 Nov 2026: the Figma "Emails" batches). Times
 * New Roman throughout, because Gmail and Outlook ignore web fonts and Times reads the same in
 * every inbox; a cream page with one white card; purple for highlights, green for good news,
 * red for problems. Email clients strip <style> and CSS variables in most inboxes, so every
 * value here is a literal used directly in inline styles.
 */
export const theme = {
  page: '#ffffff',
  /** The cream around the card. */
  panel: '#f4f3ef',
  /** The footer band and the help box inside the card. */
  soft: '#f8f7f4',
  ink: '#161615',
  body: '#55534d',
  muted: '#8a8882',
  faint: '#a3a19a',
  border: '#e4e2dd',
  hairline: '#eeede9',
  /** Kicker, ticket route and other highlights when the store has no colour of its own. */
  accent: '#6d28d9',
  good: '#15803d',
  goodBg: '#ecf7ef',
  bad: '#b42318',
  badBg: '#fdf0ee',
  /** Buttons are ink on every store: the brand colour stays for small highlights. */
  button: '#161615',
  onButton: '#ffffff',
  fontFamily: "'Times New Roman', Times, Tinos, Georgia, serif",
} as const

const HEX = /^#[0-9a-f]{6}$/i

/**
 * The store's highlight colour (kicker, route line, prices of note), falling back to purple.
 * A colour too light to read on white falls back as well.
 */
export function accentColour(brand: EmailBrandInfo | undefined): string {
  const c = brand?.colour && HEX.test(brand.colour) ? brand.colour : theme.accent
  return luminance(c) > 0.6 ? theme.accent : c
}

/** The store's brand colour and the text colour on it, falling back to ink on white. */
export function brandColours(brand: EmailBrandInfo | undefined): { bg: string; fg: string } {
  const bg = brand?.colour && HEX.test(brand.colour) ? brand.colour : theme.button
  const fg = brand?.onColour && HEX.test(brand.onColour) ? brand.onColour : theme.onButton
  // A near-white brand colour would vanish on the white page: use ink instead.
  return luminance(bg) > 0.85 ? { bg: theme.button, fg: theme.onButton } : { bg, fg }
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}

/** wa.me link for a support number, or null without one. */
export function whatsappLink(phone: string | null | undefined): string | null {
  const digits = phone?.replace(/\D/g, '') ?? ''
  return digits.length >= 8 ? `https://wa.me/${digits}` : null
}

/**
 * A picture the emails host on the store's own site (`apps/storefront/public/email`): the social
 * icons and the ticket's truck. Null without a shop address (previews of platform mail), so the
 * caller draws its text fallback instead.
 */
export function emailAsset(shopUrl: string | null | undefined, name: string): string | null {
  return shopUrl ? `${shopUrl.replace(/\/$/, '')}/email/${name}.png` : null
}
