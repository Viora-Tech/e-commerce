import { z } from 'zod'

/**
 * Which menus the storefront uses, by handle. Shopify keeps this pointer beside
 * the theme rather than on the menu itself, so a menu can be moved between the
 * header and the footer without touching its contents.
 */
export const NavigationSettingsSchema = z.object({
  /** Handle of the menu the header renders. */
  main: z.string().trim().min(1).nullable().default(null),
  /** Handles of the footer menus, in the order their columns render. */
  footer: z.array(z.string().trim().min(1)).max(8).default([]),
})

export type NavigationSettings = z.infer<typeof NavigationSettingsSchema>

export const defaultNavigationSettings: NavigationSettings = { main: null, footer: [] }

/** Parsed settings, or the empty default when nothing valid is stored. */
export function parseNavigationSettings(raw: unknown): NavigationSettings {
  const parsed = NavigationSettingsSchema.safeParse(raw)
  // A fresh object, not the shared default: callers own what they are handed.
  return parsed.success ? parsed.data : { main: null, footer: [] }
}
