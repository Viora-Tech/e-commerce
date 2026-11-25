/** SOURCE OF TRUTH: the Loyalty widget embed's settings — WHAT: the defaults the theme editor's App embeds panel starts from, and the clean settings the widget draws with (unknown values fall back, colours must be hex so nothing else reaches a style) / WHY: the embed definition, the launcher and the tests read one shape; the widget's own palette lives here so it never borrows an imported theme's CSS variables */
import { loyaltyWidgetContent } from '../../data/loyalty-widget'

const LOYALTY_LAUNCHER_ICONS = ['gift', 'star', 'crown', 'heart', 'none'] as const
export type LoyaltyLauncherIcon = (typeof LOYALTY_LAUNCHER_ICONS)[number]

/** What the embed saves (Puck props), as the merchant set them. */
export const LOYALTY_WIDGET_DEFAULTS = {
  title: '',
  layout: 'popup',
  position: 'right',
  headerColor: '#1f2937',
  headerGradient: '',
  headerText: '#ffffff',
  launcherText: 'Rewards',
  launcherIcon: 'gift',
  cardPoints: false,
  priceSelector: '',
}

/** The widget's fixed palette (body), so a theme's CSS variables never recolour it. */
const LOYALTY_PALETTE = {
  surface: '#ffffff',
  soft: '#f4f4f5',
  ink: '#18181b',
  muted: '#52525b',
  line: '#e4e4e7',
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
  cardPoints: boolean
  /** Imported themes: the CSS selector of prices to put "Earn N points" under. */
  priceSelector: string
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

const hexOr = (raw: unknown, fallback: string) =>
  typeof raw === 'string' && HEX.test(raw.trim()) ? raw.trim() : fallback

const textOr = (raw: unknown, fallback: string, max: number) =>
  typeof raw === 'string' ? raw.trim().slice(0, max) : fallback

/** The embed's saved props as the widget draws them. */
export function resolveLoyaltyWidgetSettings(
  props: Record<string, unknown> | null | undefined,
): LoyaltyWidgetSettings {
  const p = props ?? {}
  const d = LOYALTY_WIDGET_DEFAULTS
  const icon = LOYALTY_LAUNCHER_ICONS.find((i) => i === p.launcherIcon) ?? 'gift'
  const gradient = hexOr(p.headerGradient, '')
  const selector = textOr(p.priceSelector, '', 200)
  return {
    title: textOr(p.title, '', 60),
    layout: p.layout === 'sidebar' ? 'sidebar' : 'popup',
    position: p.position === 'left' ? 'left' : 'right',
    headerColor: hexOr(p.headerColor, d.headerColor),
    headerGradient: gradient || null,
    headerText: hexOr(p.headerText, d.headerText),
    launcherText: textOr(p.launcherText, d.launcherText, 30),
    launcherIcon: icon,
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
 * The widget's CSS custom properties: the header colours and the fixed palette.
 * `--kl-head` paints the launcher (one colour unless the merchant set a gradient); `--kl-hero`
 * paints the panel header, always a gradient: the merchant's, or one made from their colour
 * (Essential Loyalty's look). `--kl-accent` (icons, the Join button, progress) is the merchant
 * colour, or the ink colour when theirs is too pale to read on white; `--kl-tint` is a soft
 * wash of it behind the row icons.
 */
export function loyaltyStyleVars(s: LoyaltyWidgetSettings): Record<string, string> {
  const head = s.headerGradient
    ? `linear-gradient(135deg, ${s.headerColor}, ${s.headerGradient})`
    : s.headerColor
  const hero = s.headerGradient
    ? head
    : `linear-gradient(135deg, ${s.headerColor} 0%, color-mix(in srgb, ${s.headerColor} 72%, #ffffff) 100%)`
  const accent = brightness(s.headerColor) > 0.8 ? LOYALTY_PALETTE.ink : s.headerColor
  return {
    '--kl-head': head,
    '--kl-hero': hero,
    '--kl-accent': accent,
    '--kl-accent-text': accent === s.headerColor ? s.headerText : LOYALTY_PALETTE.surface,
    '--kl-tint': `color-mix(in srgb, ${accent} 12%, #ffffff)`,
    '--kl-head-solid': s.headerColor,
    '--kl-head-text': s.headerText,
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
