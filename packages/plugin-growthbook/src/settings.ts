import { z } from 'zod'

/**
 * The GrowthBook app's settings: pure and client-safe, shared by the admin page, the API service
 * and the storefront. They live in `store.apps.settings.growthbook` (no table). The secret API
 * key is stored encrypted (`encryptSecret`) and never leaves the server; the client key and the
 * decryption key are an SDK connection's public values (GrowthBook ships them to browsers).
 */

export const GROWTHBOOK_ID = 'growthbook'

/** GrowthBook Cloud: features from the CDN, the REST API and the app on their own hosts. */
const CLOUD_HOSTS = new Set([
  'growthbook.io',
  'app.growthbook.io',
  'cdn.growthbook.io',
  'api.growthbook.io',
])
const CLOUD_CDN = 'https://cdn.growthbook.io'
const CLOUD_API = 'https://api.growthbook.io'
const CLOUD_APP = 'https://app.growthbook.io'

/** An SDK connection's client key: `sdk-` and letters or digits. */
const CLIENT_KEY = /^sdk-[A-Za-z0-9]{4,64}$/

export const GrowthbookSettingsSchema = z.object({
  /**
   * Where GrowthBook serves features (`API_HOST` of a self-hosted GrowthBook, port 3100 by
   * default), or GrowthBook Cloud. Empty until connected.
   */
  apiHost: z.string().default(''),
  /** The SDK connection's client key (`sdk-…`): public, it only reads features. */
  clientKey: z.string().default(''),
  /** The SDK connection's decryption key, when it encrypts its features; public as well. */
  decryptionKey: z.string().default(''),
  /** Where the GrowthBook app opens, for "Open in GrowthBook" (self-hosted: port 3000). */
  appUrl: z.string().default(''),
  /** `encryptSecret` blob of a read-only secret API key; empty when none is saved. */
  secretKey: z.string().default(''),
})
export type GrowthbookSettings = z.infer<typeof GrowthbookSettingsSchema>

export const defaultGrowthbookSettings: GrowthbookSettings = GrowthbookSettingsSchema.parse({})

export function parseGrowthbookSettings(raw: unknown): GrowthbookSettings {
  const r = GrowthbookSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultGrowthbookSettings
}

/**
 * What the settings form sends, field by field. `secretKey`: a new key to store, `''` to remove
 * the saved one, left out to keep it.
 */
export const GrowthbookSettingsPatchSchema = z.object({
  apiHost: z.string().trim().max(300).optional(),
  clientKey: z.string().trim().max(100).optional(),
  decryptionKey: z.string().trim().max(200).optional(),
  appUrl: z.string().trim().max(300).optional(),
  secretKey: z.string().trim().max(2000).optional(),
})
export type GrowthbookSettingsPatch = z.infer<typeof GrowthbookSettingsPatchSchema>

export const isClientKey = (value: string): boolean => CLIENT_KEY.test(value)

/**
 * A pasted GrowthBook address as origin plus path, without a trailing slash. Null when it is not
 * an http(s) URL. Any GrowthBook Cloud host becomes the Cloud CDN.
 */
export function normaliseGrowthbookUrl(input: string): string | null {
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
  if (CLOUD_HOSTS.has(url.hostname)) return CLOUD_CDN
  const path = url.pathname.replace(/\/api(\/.*)?$/, '').replace(/\/+$/, '')
  return `${url.origin}${path}`
}

export const isGrowthbookCloud = (apiHost: string): boolean => {
  try {
    return CLOUD_HOSTS.has(new URL(apiHost).hostname)
  } catch {
    return false
  }
}

/** The features endpoint of an SDK connection. */
export function featuresUrl(apiHost: string, clientKey: string): string {
  return `${apiHost.replace(/\/+$/, '')}/api/features/${encodeURIComponent(clientKey)}`
}

/** Base of the REST API: `<apiHost>/api/v1` self-hosted, `api.growthbook.io/api/v1` on Cloud. */
export function growthbookApiBase(apiHost: string): string {
  return `${isGrowthbookCloud(apiHost) ? CLOUD_API : apiHost.replace(/\/+$/, '')}/api/v1`
}

/** The GrowthBook app: the saved address, Cloud's, or null when a self-hosted one has none. */
export function growthbookAppUrl(settings: GrowthbookSettings): string | null {
  if (settings.appUrl) return normaliseGrowthbookUrl(settings.appUrl)
  return isGrowthbookCloud(settings.apiHost) ? CLOUD_APP : null
}

/** What the storefront needs to assign shoppers: null until the app has a host and client key. */
export type GrowthbookConnection = { apiHost: string; clientKey: string; decryptionKey: string }

export function growthbookConnection(settings: GrowthbookSettings): GrowthbookConnection | null {
  const apiHost = normaliseGrowthbookUrl(settings.apiHost)
  if (!apiHost || !isClientKey(settings.clientKey)) return null
  return { apiHost, clientKey: settings.clientKey, decryptionKey: settings.decryptionKey }
}

/** The admin's view of the settings: never the secret key, only whether one is saved. */
export type GrowthbookSettingsView = {
  apiHost: string
  clientKey: string
  decryptionKey: string
  appUrl: string
  hasSecretKey: boolean
  cloud: boolean
  /** Shoppers are assigned: a host and a client key are saved. */
  assigning: boolean
  /** The app page can list experiments: assigning, plus a secret key. */
  listing: boolean
  /** Where "Open in GrowthBook" goes, if known. */
  openUrl: string | null
}

export function growthbookSettingsView(settings: GrowthbookSettings): GrowthbookSettingsView {
  const assigning = growthbookConnection(settings) !== null
  return {
    apiHost: settings.apiHost,
    clientKey: settings.clientKey,
    decryptionKey: settings.decryptionKey,
    appUrl: settings.appUrl,
    hasSecretKey: settings.secretKey !== '',
    cloud: settings.apiHost !== '' && isGrowthbookCloud(settings.apiHost),
    assigning,
    listing: assigning && settings.secretKey !== '',
    openUrl: growthbookAppUrl(settings),
  }
}
