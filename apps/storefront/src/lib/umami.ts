import { appSettingsOf, parseAppsSettings } from '@commerce/core'
import {
  parseUmamiSettings,
  UMAMI_ID,
  type UmamiTracker,
  umamiTracker,
} from '@commerce/plugin-umami/settings'

/**
 * The store's Umami tracker, from its `store.apps` entry: null unless the Umami app is
 * installed with an address and a website id. The consent banner decides when it loads
 * (`components/privacy/consent-manager.tsx`).
 */
export function umamiTrackerOf(apps: unknown): UmamiTracker | null {
  const settings = parseAppsSettings(apps)
  if (!settings.installed.includes(UMAMI_ID)) return null
  return umamiTracker(parseUmamiSettings(appSettingsOf(settings, UMAMI_ID)))
}
