import { z } from 'zod'

/**
 * Stored on store.apps. Which plugins from commerce.config.ts this store has
 * installed. The core plugin is implicit and never listed; a plugin's
 * providers only appear in settings and at checkout once it is installed.
 *
 * `settings` holds small per-app settings keyed by plugin id, for an app
 * that needs a handful of switches but no table of its own (the EMI & pay
 * later app). Each app validates its own entry; this schema only keeps the
 * shape. Uninstall keeps the entry so a reinstall picks up where the
 * merchant left off, the same as gateway credentials.
 */
export const AppsSettingsSchema = z.object({
  installed: z.array(z.string().min(1)).default([]),
  settings: z.record(z.string(), z.unknown()).optional(),
})
export type AppsSettings = z.infer<typeof AppsSettingsSchema>

export const defaultAppsSettings: AppsSettings = { installed: [] }

export function parseAppsSettings(raw: unknown): AppsSettings {
  const r = AppsSettingsSchema.safeParse(raw)
  return r.success ? r.data : defaultAppsSettings
}

/** Idempotent install: keeps order of first installation. */
export function installApp(s: AppsSettings, pluginId: string): AppsSettings {
  return s.installed.includes(pluginId) ? s : { ...s, installed: [...s.installed, pluginId] }
}

export function uninstallApp(s: AppsSettings, pluginId: string): AppsSettings {
  return { ...s, installed: s.installed.filter((id) => id !== pluginId) }
}

/** One app's raw settings entry (unvalidated; the app parses it), or undefined. */
export function appSettingsOf(s: AppsSettings, pluginId: string): unknown {
  return s.settings?.[pluginId]
}

/** Replace one app's settings entry, leaving the install list and other apps alone. */
export function withAppSettings(s: AppsSettings, pluginId: string, value: unknown): AppsSettings {
  return { ...s, settings: { ...s.settings, [pluginId]: value } }
}
