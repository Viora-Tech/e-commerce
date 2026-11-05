/** SOURCE OF TRUTH: checkout branding — WHAT: Settings → Checkout → Branding (logo, accent and button colours, one typeface from a short list, corner style, the order summary's background) stored on `store.preferences.checkout.branding`, and the CSS custom properties the storefront checkout and the admin preview both draw from / WHY: the checkout is locked like Shopify's (never a Puck template, never styled by a theme), so its whole look is these few validated values, and one pure function turns them into the same variables on both sides */
import { z } from 'zod'
import { fontStack, type ThemeFontId } from '../theme/fonts'
import { MediaRefSchema } from '../theme/schema'
import { contrastRatio } from '../theme/vars'

/*
 * Pure (no database), exported through `@commerce/core/checkout-settings` so the
 * storefront form and the admin preview import it in the browser.
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'hex colour like #1F1F21')

/** One calm typeface for the whole checkout, from faces the storefront already self-hosts. */
export const CHECKOUT_FONT_IDS = [
  'geist',
  'inter',
  'figtree',
  'manrope',
  'dm-sans',
  'plus-jakarta-sans',
  'ibm-plex-sans',
] as const satisfies readonly ThemeFontId[]
export type CheckoutFontId = (typeof CHECKOUT_FONT_IDS)[number]

export const CHECKOUT_CORNERS = ['sharp', 'soft', 'round'] as const
export type CheckoutCorners = (typeof CHECKOUT_CORNERS)[number]

/** The neutral look a store gets before it picks anything. */
export const DEFAULT_CHECKOUT_COLOURS = {
  accent: '#171717',
  button: '#171717',
  summary: '#FFFFFF',
} as const

export const CheckoutBrandingSchema = z.object({
  /** Shown at the top of the summary; falls back to the theme's logo, then the store name. */
  logo: MediaRefSchema.nullable().default(null),
  /** Focus rings, the picked option's border, links and check marks. */
  accent: hex.default(DEFAULT_CHECKOUT_COLOURS.accent),
  /** The Pay button. Its text turns white or near-black, whichever reads better. */
  button: hex.default(DEFAULT_CHECKOUT_COLOURS.button),
  font: z.enum(CHECKOUT_FONT_IDS).default('geist'),
  corners: z.enum(CHECKOUT_CORNERS).default('soft'),
  /** The order summary column: a solid colour, or an image under a wash of that colour. */
  summary: z
    .object({
      kind: z.enum(['solid', 'image']).default('solid'),
      colour: hex.default(DEFAULT_CHECKOUT_COLOURS.summary),
      image: MediaRefSchema.nullable().default(null),
    })
    .prefault({}),
  /** "Secure checkout · UPI · Cards" line under the Pay button. */
  trustBadges: z.boolean().default(true),
})
export type CheckoutBranding = z.infer<typeof CheckoutBrandingSchema>

const INK_DARK = '#111111'
const INK_LIGHT = '#FFFFFF'

/** White or near-black, whichever has more contrast on `background`. */
function readableInk(background: string): string {
  return contrastRatio(background, INK_LIGHT) >= contrastRatio(background, INK_DARK)
    ? INK_LIGHT
    : INK_DARK
}

/** Field and card radius, then button radius, per corner style. */
const RADII: Record<CheckoutCorners, [string, string]> = {
  sharp: ['0.25rem', '0.25rem'],
  soft: ['0.625rem', '0.625rem'],
  round: ['0.875rem', '62.5rem'],
}

/**
 * The checkout's light neutrals, for the admin preview, which has no storefront stylesheet.
 * The storefront defines the same values (and their dark twins) on `.ck` in globals.css;
 * keep the two in step.
 */
export const CHECKOUT_LIGHT_SURFACE: Record<string, string> = {
  '--ck-bg': '#FFFFFF',
  '--ck-ink': '#0A0A0A',
  '--ck-muted': '#737373',
  '--ck-line': '#E5E5E5',
  '--ck-field': '#FFFFFF',
  '--ck-soft': '#F5F5F5',
  '--ck-canvas': '#FAFAFA',
  '--ck-success': '#1D8A50',
  '--ck-card-shadow':
    '0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px rgb(0 0 0 / 0.06)',
}

/** A url() value that cannot break out of the declaration; the url is already schema-checked. */
const cssUrl = (url: string): string => `url("${url.replace(/["\\\n\r]/g, '')}")`

/**
 * The checkout's custom properties. The shell sets them on its root element; the
 * storefront's globals.css maps them to Tailwind tokens (`bg-ck-button`, `rounded-ck`)
 * and darkens the summary in dark mode. The admin preview sets the same ones.
 */
export function checkoutBrandingVars(branding: CheckoutBranding): Record<string, string> {
  const { summary } = branding
  const [radius, buttonRadius] = RADII[branding.corners]
  const image = summary.kind === 'image' && summary.image ? summary.image.url : null
  return {
    '--ck-accent': branding.accent,
    '--ck-accent-ink': readableInk(branding.accent),
    '--ck-button': branding.button,
    '--ck-button-ink': readableInk(branding.button),
    '--ck-radius': radius,
    '--ck-radius-button': buttonRadius,
    '--ck-font': fontStack(branding.font),
    '--ck-summary-light': summary.colour,
    '--ck-summary-ink-light': readableInk(summary.colour),
    '--ck-summary-image': image ? cssUrl(image) : 'none',
  }
}
