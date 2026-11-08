import { z } from 'zod'
import type { UmamiTracker } from './tracker'

/**
 * The Umami app's settings: pure and client-safe, shared by the admin page, the API service
 * and the storefront. They live in `store.apps.settings.umami` (no table). The API key is
 * stored encrypted (`encryptSecret`) and never leaves the server; everything else here is
 * public anyway (the tracker script and website id are in every page's HTML).
 */

export const UMAMI_ID = 'umami'

/** Umami Cloud: the dashboard and tracker on `cloud.umami.is`, the API on `api.umami.is/v1`. */
const CLOUD_HOSTS = new Set(['umami.is', 'cloud.umami.is', 'api.umami.is'])
const CLOUD_API = 'https://api.umami.is/v1'
const CLOUD_SCRIPT = 'https://cloud.umami.is/script.js'

/** Umami website ids are UUIDs. */
const WEBSITE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const UmamiSettingsSchema = z.object({
  /** Where Umami runs: `https://analytics.example.com`, or Umami Cloud. Empty until connected. */
  url: z.string().default(''),
  /** The Umami website this store reports to. */
  websiteId: z.string().default(''),
  /** `encryptSecret` blob of the Umami API key (or a login token); empty when none is saved. */
  apiKey: z.string().default(''),
  /**
   * Load the tracker only after the shopper allows analytics on the cookie banner. Umami sets
   * no cookies, so a store may choose to count every visit unless the shopper said no.
   */
  waitForConsent: z.boolean().default(true),
})
export type UmamiSettings = z.infer<typeof UmamiSettingsSchema>

export const defaultUmamiSettings: UmamiSettings = UmamiSettingsSchema.parse({})

export function parseUmamiSettings(raw: unknown): UmamiSettings {
  const r = UmamiSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultUmamiSettings
}

/**
 * What the settings form sends. Spelled out field by field (zod 4's `.partial()` would fill
 * defaults and reset what the form left out). `apiKey`: a new key to store, `''` to remove the
 * saved one, left out to keep it.
 */
export const UmamiSettingsPatchSchema = z.object({
  url: z.string().trim().max(300).optional(),
  websiteId: z.string().trim().max(64).optional(),
  apiKey: z.string().trim().max(2000).optional(),
  waitForConsent: z.boolean().optional(),
})
export type UmamiSettingsPatch = z.infer<typeof UmamiSettingsPatchSchema>

export const isWebsiteId = (value: string): boolean => WEBSITE_ID.test(value)

/**
 * A pasted Umami address as the origin plus any path Umami is served under, without a trailing
 * slash (`https://example.com/umami`). Null when it is not an http(s) URL. A pasted dashboard or
 * script link (`…/websites/<id>`, `…/script.js`) is trimmed back to the Umami root.
 */
export function normaliseUmamiUrl(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  if (CLOUD_HOSTS.has(url.hostname)) return 'https://cloud.umami.is'
  const path = url.pathname
    .replace(/\/(script\.js|websites(\/.*)?|dashboard(\/.*)?|login|settings(\/.*)?)$/, '')
    .replace(/\/+$/, '')
  return `${url.origin}${path}`
}

export const isUmamiCloud = (url: string): boolean => {
  try {
    return CLOUD_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

/** Base of the REST API: `<url>/api` for a self-hosted Umami, `api.umami.is/v1` for Cloud. */
export function umamiApiBase(url: string): string {
  return isUmamiCloud(url) ? CLOUD_API : `${url.replace(/\/+$/, '')}/api`
}

/** The tracker script: `<url>/script.js`, or Cloud's. */
export function umamiScriptSrc(url: string): string {
  return isUmamiCloud(url) ? CLOUD_SCRIPT : `${url.replace(/\/+$/, '')}/script.js`
}

/** The tracker for a store, or null until the app has an address and a valid website id. */
export function umamiTracker(settings: UmamiSettings): UmamiTracker | null {
  const url = normaliseUmamiUrl(settings.url)
  if (!url || !isWebsiteId(settings.websiteId)) return null
  return {
    src: umamiScriptSrc(url),
    websiteId: settings.websiteId.toLowerCase(),
    waitForConsent: settings.waitForConsent,
  }
}

/** The admin's view of the settings: never the key itself, only whether one is saved. */
export type UmamiSettingsView = {
  url: string
  websiteId: string
  hasApiKey: boolean
  waitForConsent: boolean
  cloud: boolean
  /** Shoppers are counted: an address and a website id are saved. */
  tracking: boolean
  /** The Analytics page can read reports: tracking, plus an API key. */
  reporting: boolean
}

export function umamiSettingsView(settings: UmamiSettings): UmamiSettingsView {
  const tracking = umamiTracker(settings) !== null
  return {
    url: settings.url,
    websiteId: settings.websiteId,
    hasApiKey: settings.apiKey !== '',
    waitForConsent: settings.waitForConsent,
    cloud: settings.url !== '' && isUmamiCloud(settings.url),
    tracking,
    reporting: tracking && settings.apiKey !== '',
  }
}

export { type UmamiTracker, umamiAllowed } from './tracker'
