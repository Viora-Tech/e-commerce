import { SEARCH_CONSOLE_APP_ID } from '@commerce/core/search-console'
import { z } from 'zod'

/**
 * The Google Search Console app's settings: pure and client-safe, shared by the API service,
 * the worker job and the admin. They live in `store.apps.settings['google-search-console']`
 * (no table; the numbers themselves are in `search_console_row`). The Google refresh token is
 * stored encrypted (`encryptSecret`) and never leaves the server.
 */

export { SEARCH_CONSOLE_APP_ID }

const DateRangeSchema = z.object({ start: z.string(), end: z.string() })
export type SearchDateRange = z.infer<typeof DateRangeSchema>

export const SearchConsoleSettingsSchema = z.object({
  /** `encryptSecret` blob of Google's refresh token; empty when not connected. */
  refreshToken: z.string().default(''),
  /** The Google account that connected, as Google reported it. */
  email: z.string().default(''),
  /** The Search Console property: `sc-domain:example.com` or `https://www.example.com/`. */
  property: z.string().default(''),
  connectedAt: z.string().default(''),
  /** Last sync try, finished or not (ISO); the worker's daily schedule reads it. */
  attemptedAt: z.string().default(''),
  /** Last sync that stored fresh numbers (ISO). */
  syncedAt: z.string().default(''),
  /** Last "Refresh now" (ISO), for its rate limit. */
  refreshedAt: z.string().default(''),
  /** Why the last sync failed, in words; empty after a good one. */
  lastError: z.string().default(''),
  /** Google no longer accepts the saved access (revoked, or the password changed): connect again. */
  reconnect: z.boolean().default(false),
  /** The days the stored numbers cover. */
  ranges: z
    .object({ current: DateRangeSchema, previous: DateRangeSchema })
    .nullable()
    .default(null),
})
export type SearchConsoleSettings = z.infer<typeof SearchConsoleSettingsSchema>

export const defaultSearchConsoleSettings: SearchConsoleSettings =
  SearchConsoleSettingsSchema.parse({})

export function parseSearchConsoleSettings(raw: unknown): SearchConsoleSettings {
  const r = SearchConsoleSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultSearchConsoleSettings
}

/** "Refresh now" may run once per this long; the worker syncs daily anyway. */
export const REFRESH_COOLDOWN_MS = 15 * 60_000

/** The admin's view of the settings: never the token, only whether one is saved. */
export type SearchConsoleView = {
  /** This deployment has a Google OAuth client for Search Console. */
  available: boolean
  connected: boolean
  email: string
  property: string
  syncedAt: string | null
  lastError: string
  reconnect: boolean
  ranges: SearchConsoleSettings['ranges']
  /** When "Refresh now" works again (ISO), or null when it works now. */
  refreshAfter: string | null
}

export function searchConsoleView(
  settings: SearchConsoleSettings,
  available: boolean,
  now: Date = new Date(),
): SearchConsoleView {
  const last = Date.parse(settings.refreshedAt)
  const next = Number.isFinite(last) ? last + REFRESH_COOLDOWN_MS : 0
  return {
    available,
    connected: settings.refreshToken !== '',
    email: settings.email,
    property: settings.property,
    syncedAt: settings.syncedAt || null,
    lastError: settings.lastError,
    reconnect: settings.reconnect,
    ranges: settings.ranges,
    refreshAfter: next > now.getTime() ? new Date(next).toISOString() : null,
  }
}

/** One Search Console property the Google account can see. */
export type SearchConsoleSite = { siteUrl: string; permissionLevel: string }

/** An unverified listing gives no data: Google answers 403 for it. */
export const isUsableSite = (site: SearchConsoleSite): boolean =>
  site.permissionLevel !== 'siteUnverifiedUser'

/** The host of a URL-prefix property (`https://www.example.com/` → `www.example.com`). */
function prefixHost(siteUrl: string): string | null {
  if (!/^https?:\/\//i.test(siteUrl)) return null
  try {
    return new URL(siteUrl).hostname.toLowerCase()
  } catch {
    return null
  }
}

/** Whether a property covers a hostname: a domain property covers its subdomains too. */
export function propertyCovers(siteUrl: string, hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (siteUrl.startsWith('sc-domain:')) {
    const domain = siteUrl.slice('sc-domain:'.length).toLowerCase()
    return host === domain || host.endsWith(`.${domain}`)
  }
  return prefixHost(siteUrl) === host
}

/**
 * The property that matches the store's live domains, to pre-select in the picker. Hostnames
 * come primary first. For each, a domain property wins (it counts http, https and www), then
 * an https URL-prefix property, then http. Null when nothing matches.
 */
export function suggestProperty(
  sites: readonly SearchConsoleSite[],
  hostnames: readonly string[],
): string | null {
  const usable = sites.filter(isUsableSite)
  for (const host of hostnames) {
    const covering = usable.filter((s) => propertyCovers(s.siteUrl, host))
    const rank = (s: SearchConsoleSite) =>
      s.siteUrl.startsWith('sc-domain:') ? 0 : s.siteUrl.startsWith('https:') ? 1 : 2
    const best = covering.sort((a, b) => rank(a) - rank(b))[0]
    if (best) return best.siteUrl
  }
  return null
}

/**
 * The sitemap to submit for a property: on the property's own host when it is a URL-prefix
 * property for one of the store's domains, else on the store's primary address.
 */
export function sitemapUrlFor(
  property: string,
  hostnames: readonly string[],
  primaryOrigin: string,
): string {
  const host = prefixHost(property)
  if (host && hostnames.includes(host)) return `${new URL(property).origin}/sitemap.xml`
  return `${primaryOrigin.replace(/\/+$/, '')}/sitemap.xml`
}
