/** SOURCE OF TRUTH: the Loyalty widget embed's settings — WHAT: the defaults the theme editor's App embeds panel starts from, and the clean settings the widget draws with (unknown values fall back, colours must be hex so nothing else reaches a style) / WHY: the embed definition, the launcher and the tests read one shape; the widget's own palette lives here so it never borrows an imported theme's CSS variables */
import { loyaltyWidgetContent } from '../../data/loyalty-widget'

const LOYALTY_LAUNCHER_ICONS = ['gift', 'star', 'crown', 'heart', 'none'] as const
export type LoyaltyLauncherIcon = (typeof LOYALTY_LAUNCHER_ICONS)[number]

/** What the embed saves (Puck props), as the merchant set them. */
export const LOYALTY_WIDGET_DEFAULTS = {
  title: '',
  layout: 'popup',
  position: 'right',
  /** Empty: the store's brand colour (checkout accent, else the live theme's button colour). */
  headerColor: '',
  headerGradient: '',
  headerText: '#ffffff',
  launcherText: 'Rewards',
  launcherIcon: 'gift',
  productLine: true,
  cartBox: true,
  pointsValue: false,
  cardPoints: false,
  priceSelector: '',
}

/** The header colour every embed saved before 26 Nov 2026: a stock value, never a pick. */
const OLD_STOCK_HEADER = '#1f2937'

/** Used when the store has no brand colour either. */
const FALLBACK_BRAND = '#3c56e9'

/** The widget's fixed palette (body), so a theme's CSS variables never recolour it. */
const LOYALTY_PALETTE = {
  surface: '#ffffff',
  soft: '#f5f5f5',
  ink: '#1a1a1a',
  muted: '#555555',
  line: '#e5e5e5',
  /** Join now, Claim, Redeem and apply: near-black, as Essential Loyalty's buttons. */
  button: '#222222',
  success: '#15803d',
  danger: '#b91c1c',
}

export type LoyaltyWidgetSettings = {
  /** Empty: "{Store} Rewards". */
  title: string
  layout: 'popup' | 'sidebar'
  position: 'left' | 'right'
  headerColor: string
  /** A second colour for a gradient header, or null for a flat one. */
  headerGradient: string | null
  headerText: string
  launcherText: string
  launcherIcon: LoyaltyLauncherIcon
  /** "Earn N points with this purchase" above the product page's buy buttons. */
  productLine: boolean
  /** The points box above the cart's Checkout button (cart page and cart drawer). */
  cartBox: boolean
  /** Add what the points are worth in rupees ("worth ₹20") to the product line and cart box. */
  pointsValue: boolean
  cardPoints: boolean
  /** Imported themes: the CSS selector of prices to put "Earn N points" under. */
  priceSelector: string
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

const hexOr = (raw: unknown, fallback: string) =>
  typeof raw === 'string' && HEX.test(raw.trim()) ? raw.trim() : fallback

const textOr = (raw: unknown, fallback: string, max: number) =>
  typeof raw === 'string' ? raw.trim().slice(0, max) : fallback

/**
 * The embed's saved props as the widget draws them. `brand` is the store's brand colour: the
 * header follows it until the merchant picks a header colour of their own.
 */
export function resolveLoyaltyWidgetSettings(
  props: Record<string, unknown> | null | undefined,
  brand?: string | null,
): LoyaltyWidgetSettings {
  const p = props ?? {}
  const d = LOYALTY_WIDGET_DEFAULTS
  const brandColor = hexOr(brand, FALLBACK_BRAND)
  const picked = hexOr(p.headerColor, '')
  const icon = LOYALTY_LAUNCHER_ICONS.find((i) => i === p.launcherIcon) ?? 'gift'
  const gradient = hexOr(p.headerGradient, '')
  const selector = textOr(p.priceSelector, '', 200)
  return {
    title: textOr(p.title, '', 60),
    layout: p.layout === 'sidebar' ? 'sidebar' : 'popup',
    position: p.position === 'left' ? 'left' : 'right',
    headerColor: picked && picked.toLowerCase() !== OLD_STOCK_HEADER ? picked : brandColor,
    headerGradient: gradient || null,
    headerText: hexOr(p.headerText, d.headerText),
    launcherText: textOr(p.launcherText, d.launcherText, 30),
    launcherIcon: icon,
    productLine: p.productLine !== false,
    cartBox: p.cartBox !== false,
    pointsValue: p.pointsValue === true,
    cardPoints: p.cardPoints === true,
    // A selector with markup or braces is never one a merchant meant.
    priceSelector: /[<>{}]/.test(selector) ? '' : selector,
  }
}

/** `#rgb` or `#rrggbb` to 0..255 channels. */
function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
}

/** Relative brightness 0 (black) to 1 (white), for picking a readable accent. */
export function brightness(hex: string): number {
  const [r, g, b] = channels(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/**
 * The widget's CSS custom properties: the header colours and the fixed palette. `--kl-head`
 * paints the launcher and the header (one colour unless the merchant set a gradient);
 * `--kl-head-solid` is the colour the header fades from behind the first card. `--kl-accent`
 * (icons, links, progress bars) is the header colour, or the ink colour when it is too pale to
 * read on white. Buttons are near-black (`--kl-button`), Essential Loyalty's look.
 */
export function loyaltyStyleVars(s: LoyaltyWidgetSettings): Record<string, string> {
  const head = s.headerGradient
    ? `linear-gradient(135deg, ${s.headerColor}, ${s.headerGradient})`
    : s.headerColor
  const accent = brightness(s.headerColor) > 0.8 ? LOYALTY_PALETTE.ink : s.headerColor
  return {
    '--kl-head': head,
    '--kl-accent': accent,
    '--kl-tint': `color-mix(in srgb, ${accent} 12%, #ffffff)`,
    '--kl-head-solid': s.headerColor,
    '--kl-head-text': s.headerText,
    '--kl-button': LOYALTY_PALETTE.button,
    '--kl-button-text': LOYALTY_PALETTE.surface,
    '--kl-surface': LOYALTY_PALETTE.surface,
    '--kl-soft': LOYALTY_PALETTE.soft,
    '--kl-ink': LOYALTY_PALETTE.ink,
    '--kl-muted': LOYALTY_PALETTE.muted,
    '--kl-line': LOYALTY_PALETTE.line,
    '--kl-success': LOYALTY_PALETTE.success,
    '--kl-danger': LOYALTY_PALETTE.danger,
  }
}

/** The program's name: the merchant's, or "{Store} Rewards". */
export function programTitle(s: Pick<LoyaltyWidgetSettings, 'title'>, storeName: string): string {
  return s.title || loyaltyWidgetContent.programName(storeName)
}
