import { z } from 'zod'

/**
 * Stored on store.apps. Which plugins from commerce.config.ts this store has
 * installed. The core plugin is implicit and never listed; a plugin's
 * providers only appear in settings and at checkout once it is installed.
 */
export const AppsSettingsSchema = z.object({
  installed: z.array(z.string().min(1)).default([]),
})
export type AppsSettings = z.infer<typeof AppsSettingsSchema>

export const defaultAppsSettings: AppsSettings = { installed: [] }

export function parseAppsSettings(raw: unknown): AppsSettings {
  const r = AppsSettingsSchema.safeParse(raw)
  return r.success ? r.data : defaultAppsSettings
}

/** Idempotent install: keeps order of first installation. */
export function installApp(s: AppsSettings, pluginId: string): AppsSettings {
  return s.installed.includes(pluginId) ? s : { installed: [...s.installed, pluginId] }
}

export function uninstallApp(s: AppsSettings, pluginId: string): AppsSettings {
  return { installed: s.installed.filter((id) => id !== pluginId) }
}
