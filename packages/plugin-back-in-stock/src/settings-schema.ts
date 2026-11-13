import { z } from 'zod'

/*
 * The app's per-store settings shape and the pure helpers around it. No database import, so
 * the admin's client bundle can use it (`@commerce/plugin-back-in-stock/settings-schema`).
 */

export const BackInStockStoreSettingsSchema = z.object({
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
   * ("Notify me"), which is what every store showed before this setting existed.
   */
  buttonText: z.string().trim().max(60).default(''),
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

/** The "Button text" choices the settings page offers ('' is the storefront default). */
export const NOTIFY_BUTTON_TEXTS = [
  '',
  "Notify me when it's back",
  "Email me when it's back",
  'Remind me',
] as const

/** The storefront's own button text when `buttonText` is empty. */
export const DEFAULT_NOTIFY_BUTTON_TEXT = 'Notify me'

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
