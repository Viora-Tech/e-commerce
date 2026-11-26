import { z } from 'zod'

/*
 * The app's per-store settings shape and the pure helpers around it. No database import, so
 * the admin's client bundle can use it (`@commerce/plugin-back-in-stock/settings-schema`).
 *
 * The campaign fields follow Essential's back-in-stock campaign (Notification settings, Button,
 * Pop up, Email, Products). Every new field has a default that keeps what a store saw before it
 * existed, so a stored row without them parses to today's behaviour; no migration (JSON column).
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const words = (max: number, fallback: string) => z.string().trim().max(max).default(fallback)

/** Corner rounding choices for the custom Notify me button; the storefront maps them to rem. */
export const BUTTON_RADII = ['none', 'small', 'medium', 'large', 'full'] as const
export type ButtonRadius = (typeof BUTTON_RADII)[number]

/** Where the Notify me button shows: every product, chosen collections, or chosen products. */
export const SHOW_ON = ['all', 'collections', 'products'] as const
export type ShowOn = (typeof SHOW_ON)[number]

/** The pop-up's words, as Essential's defaults read (in our own words where they differ). */
export const POPUP_DEFAULTS = {
  popupHeading: 'Notify me',
  popupDescription: 'Would you like us to let you know when {product} becomes available?',
  emailPlaceholder: 'Email',
  emailError: 'Enter a valid email address',
  submitText: 'Notify me',
  disclaimer: "We'll only email you when the product becomes available.",
  successHeading: 'Thank you!',
  successMessage: "We'll let you know as soon as it's back.",
  newsletterText: 'Also send me news and offers',
} as const

export const BackInStockStoreSettingsSchema = z.object({
  /** "Live" in the campaign header; off hides the Notify me button (signups already in still get their alert). */
  enabled: z.boolean().default(true),
  /** The campaign's name, only seen in the admin. */
  title: words(80, 'Back in stock campaign'),
  emailEnabled: z.boolean().default(true),
  whatsappEnabled: z.boolean().default(false),
  /** Messages sent per minute per store while fanning out a restock. */
  batchSize: z.number().int().min(1).max(2000).default(200),
  confirmSubject: z.string().default(''),
  confirmBody: z.string().default(''),
  alertSubject: z.string().default(''),
  alertBody: z.string().default(''),
  /**
   * The storefront "Notify me" button's words. Empty keeps the storefront's own default
   * (`DEFAULT_NOTIFY_BUTTON_TEXT`).
   */
  buttonText: z.string().trim().max(60).default(''),
  /** `theme` draws the button like the theme's Add to cart; `custom` uses the colours below. */
  buttonStyle: z.enum(['theme', 'custom']).default('theme'),
  buttonBackground: hex.default('#008060'),
  buttonTextColor: hex.default('#ffffff'),
  buttonRadius: z.enum(BUTTON_RADII).default('medium'),
  /** `popup`: a button that opens the form (Essential). `inline`: the form sits in the sold-out panel. */
  display: z.enum(['popup', 'inline']).default('popup'),
  popupHeading: words(80, POPUP_DEFAULTS.popupHeading),
  popupDescription: words(300, POPUP_DEFAULTS.popupDescription),
  emailPlaceholder: words(60, POPUP_DEFAULTS.emailPlaceholder),
  emailError: words(120, POPUP_DEFAULTS.emailError),
  submitText: words(60, POPUP_DEFAULTS.submitText),
  disclaimer: words(300, POPUP_DEFAULTS.disclaimer),
  successHeading: words(80, POPUP_DEFAULTS.successHeading),
  successMessage: words(300, POPUP_DEFAULTS.successMessage),
  /** `ask` adds a newsletter checkbox; ticking it starts the store's newsletter double opt-in. */
  newsletter: z.enum(['off', 'ask']).default('off'),
  newsletterText: words(200, POPUP_DEFAULTS.newsletterText),
  newsletterPrechecked: z.boolean().default(false),
  /**
   * Double opt-in for email signups (Essential's "GDPR compliance"): a confirm email first, and
   * only confirmed signups get the alert. On by default, as before.
   */
  doubleOptIn: z.boolean().default(true),
  showOn: z.enum(SHOW_ON).default('all'),
  collectionIds: z.array(z.uuid()).max(500).default([]),
  productIds: z.array(z.uuid()).max(2000).default([]),
  /**
   * Whether the Notify me form asks for a phone number. It only ever shows when WhatsApp
   * alerts are on and the store has a WhatsApp channel; on by default, as before.
   */
  askPhone: z.boolean().default(true),
  /**
   * Exempts this store from the free quota. Set via seed/config for a store
   * that pays for its own sending (e.g. the platform's own store); never
   * written by the signup or send paths themselves.
   */
  unlimited: z.boolean().default(false),
})

/** The "Button text" suggestions the campaign page offers ('' is the storefront default). */
export const NOTIFY_BUTTON_TEXTS = [
  '',
  "Notify me when it's back",
  "Email me when it's back",
  'Remind me',
] as const

/** The storefront's own button text when `buttonText` is empty (Essential's default words). */
export const DEFAULT_NOTIFY_BUTTON_TEXT = 'Notify me when available'

/** The "Alerts per minute" choices the settings page offers. */
export const ALERTS_PER_MINUTE_CHOICES = [10, 30, 60, 120, 200, 500, 1000, 2000] as const

/**
 * Roughly how many minutes a restock of `signups` alerts takes at `perMinute` (the settings
 * page's "500 signups ≈ 8 minutes" hint). 0 means it all goes out within the first minute.
 */
export function restockMinutes(signups: number, perMinute: number): number {
  if (!(signups > 0) || !(perMinute > 0)) return 0
  if (signups <= perMinute) return 0
  return Math.max(1, Math.round(signups / perMinute))
}

export type BackInStockStoreSettings = z.infer<typeof BackInStockStoreSettingsSchema>

export const defaultBackInStockStoreSettings: BackInStockStoreSettings =
  BackInStockStoreSettingsSchema.parse({})

/**
 * Whether the campaign shows the Notify me button on a product, from the product's own id and
 * the collections it sits in. Pure, so the admin preview and the storefront agree.
 */
export function campaignShowsOn(
  settings: Pick<BackInStockStoreSettings, 'enabled' | 'showOn' | 'collectionIds' | 'productIds'>,
  productId: string,
  productCollectionIds: readonly string[],
): boolean {
  if (!settings.enabled) return false
  if (settings.showOn === 'all') return true
  if (settings.showOn === 'products') return settings.productIds.includes(productId)
  return productCollectionIds.some((id) => settings.collectionIds.includes(id))
}

/**
 * What the storefront's Notify me button and pop-up draw: serialisable, no contact data. The
 * description keeps its `{product}` token; the form fills in the product and variant.
 */
export type NotifyWidget = {
  buttonText: string
  buttonStyle: 'theme' | 'custom'
  buttonBackground: string
  buttonTextColor: string
  buttonRadius: ButtonRadius
  display: 'popup' | 'inline'
  popupHeading: string
  popupDescription: string
  emailPlaceholder: string
  emailError: string
  submitText: string
  disclaimer: string
  successHeading: string
  successMessage: string
  newsletter: boolean
  newsletterText: string
  newsletterPrechecked: boolean
}

/** The storefront widget for a store's settings; empty words fall back to the defaults. */
export function notifyWidgetOf(s: BackInStockStoreSettings): NotifyWidget {
  const or = (v: string, d: string) => v.trim() || d
  return {
    buttonText: or(s.buttonText, DEFAULT_NOTIFY_BUTTON_TEXT),
    buttonStyle: s.buttonStyle,
    buttonBackground: s.buttonBackground,
    buttonTextColor: s.buttonTextColor,
    buttonRadius: s.buttonRadius,
    display: s.display,
    popupHeading: or(s.popupHeading, POPUP_DEFAULTS.popupHeading),
    popupDescription: or(s.popupDescription, POPUP_DEFAULTS.popupDescription),
    emailPlaceholder: or(s.emailPlaceholder, POPUP_DEFAULTS.emailPlaceholder),
    emailError: or(s.emailError, POPUP_DEFAULTS.emailError),
    submitText: or(s.submitText, POPUP_DEFAULTS.submitText),
    disclaimer: s.disclaimer.trim(),
    successHeading: or(s.successHeading, POPUP_DEFAULTS.successHeading),
    successMessage: or(s.successMessage, POPUP_DEFAULTS.successMessage),
    newsletter: s.newsletter === 'ask',
    newsletterText: or(s.newsletterText, POPUP_DEFAULTS.newsletterText),
    newsletterPrechecked: s.newsletterPrechecked,
  }
}

/** The pop-up description with `{product}` filled in ("Wooting 80HE+ - Frost White"). */
export function describeProduct(
  template: string,
  productTitle: string,
  variantTitle?: string | null,
): string {
  const name =
    variantTitle && variantTitle !== 'Default' && variantTitle !== 'Default Title'
      ? `${productTitle} - ${variantTitle}`
      : productTitle
  return template.replaceAll('{product}', name)
}

/** The custom button's corner rounding in rem. */
export const BUTTON_RADIUS_REM: Record<ButtonRadius, string> = {
  none: '0rem',
  small: '0.25rem',
  medium: '0.5rem',
  large: '0.75rem',
  full: '999rem',
}
