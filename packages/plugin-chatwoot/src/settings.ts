import { z } from 'zod'
import { CHATWOOT_CONSENT, type ChatwootConsent, type ChatwootWidget } from './widget'

/**
 * The Chatwoot app's settings: pure and client-safe, shared by the admin page, the API service,
 * the worker hook and the storefront. They live in `store.apps.settings.chatwoot` (no table).
 * The API access token and the HMAC identity secret are stored encrypted (`encryptSecret`) and
 * never leave the server; the address, account id and website token are public anyway (the
 * widget script carries them in every page).
 */

export const CHATWOOT_ID = 'chatwoot'

/** Chatwoot Cloud. A self-hosted Chatwoot has its own address. */
export const CHATWOOT_CLOUD = 'https://app.chatwoot.com'
const CLOUD_HOSTS = new Set(['chatwoot.com', 'www.chatwoot.com', 'app.chatwoot.com'])

/** Chatwoot account ids are numbers (`/app/accounts/<id>/...`). */
const ACCOUNT_ID = /^\d{1,12}$/

/** A website inbox token (Settings → Inboxes → the website inbox → Configuration). */
const WEBSITE_TOKEN = /^[A-Za-z0-9_-]{8,64}$/

export const ChatwootSettingsSchema = z.object({
  /** Where Chatwoot runs: `https://app.chatwoot.com` or a self-hosted address. Empty until connected. */
  baseUrl: z.string().default(''),
  /** The Chatwoot account the store's inbox lives in. */
  accountId: z.string().default(''),
  /** `encryptSecret` blob of an agent's or bot's API access token; empty when none is saved. */
  apiToken: z.string().default(''),
  /** The website inbox's public token: the widget on the storefront. */
  websiteToken: z.string().default(''),
  /** `encryptSecret` blob of the inbox's HMAC token (identity validation); empty when none is saved. */
  hmacToken: z.string().default(''),
  /** The cookie category the widget waits for. `necessary`: it loads for everyone. */
  consent: z.enum(CHATWOOT_CONSENT).default('necessary'),
  /** Tell Chatwoot who a signed-in shopper is (name, email, phone, order history). Needs the HMAC token. */
  identifyShoppers: z.boolean().default(true),
  /** Keep a Chatwoot contact for every customer, updated when they change or pay. Needs the API token. */
  syncContacts: z.boolean().default(true),
})
export type ChatwootSettings = z.infer<typeof ChatwootSettingsSchema>

export const defaultChatwootSettings: ChatwootSettings = ChatwootSettingsSchema.parse({})

export function parseChatwootSettings(raw: unknown): ChatwootSettings {
  const r = ChatwootSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultChatwootSettings
}

/**
 * What the settings form sends, field by field (zod 4's `.partial()` would fill defaults and
 * reset what the form left out). A secret: a new value to store, `''` to remove the saved one,
 * left out to keep it.
 */
export const ChatwootSettingsPatchSchema = z.object({
  baseUrl: z.string().trim().max(300).optional(),
  accountId: z.string().trim().max(20).optional(),
  apiToken: z.string().trim().max(500).optional(),
  websiteToken: z.string().trim().max(100).optional(),
  hmacToken: z.string().trim().max(500).optional(),
  consent: z.enum(CHATWOOT_CONSENT).optional(),
  identifyShoppers: z.boolean().optional(),
  syncContacts: z.boolean().optional(),
})
export type ChatwootSettingsPatch = z.infer<typeof ChatwootSettingsPatchSchema>

export const isAccountId = (value: string): boolean => ACCOUNT_ID.test(value)
export const isWebsiteToken = (value: string): boolean => WEBSITE_TOKEN.test(value)

/**
 * A pasted Chatwoot address as its origin plus any path it is served under, without a trailing
 * slash. Null when it is not an http(s) URL. A pasted dashboard link
 * (`…/app/accounts/3/dashboard`) is trimmed back to the root, and `chatwoot.com` means Cloud.
 */
export function normaliseChatwootUrl(input: string): string | null {
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
  if (CLOUD_HOSTS.has(url.hostname)) return CHATWOOT_CLOUD
  const path = url.pathname.replace(/\/(app|packs|widget|api)(\/.*)?$/, '').replace(/\/+$/, '')
  return `${url.origin}${path}`
}

/** The account id from a pasted dashboard link (`…/app/accounts/3/…`), else null. */
export function accountIdFromUrl(input: string): string | null {
  const match = /\/app\/accounts\/(\d+)/.exec(input)
  return match?.[1] ?? null
}

export const isChatwootCloud = (url: string): boolean => url === CHATWOOT_CLOUD

/** Pages in the Chatwoot dashboard. */
export const chatwootLinks = (baseUrl: string, accountId: string) => {
  const root = `${baseUrl}/app/accounts/${accountId}`
  return {
    dashboard: `${root}/dashboard`,
    conversation: (id: number) => `${root}/conversations/${id}`,
    contact: (id: number) => `${root}/contacts/${id}`,
  }
}

/** The widget for a store, or null until the app has an address and a website token. */
export function chatwootWidgetOf(settings: ChatwootSettings): ChatwootWidget | null {
  const baseUrl = normaliseChatwootUrl(settings.baseUrl)
  if (!baseUrl || !isWebsiteToken(settings.websiteToken)) return null
  return { baseUrl, websiteToken: settings.websiteToken, consent: settings.consent }
}

/** The API is usable: an address, an account id and an API token. */
export function chatwootApiReady(settings: ChatwootSettings): boolean {
  return (
    normaliseChatwootUrl(settings.baseUrl) !== null &&
    isAccountId(settings.accountId) &&
    settings.apiToken !== ''
  )
}

/** The admin's view of the settings: never a secret, only whether one is saved. */
export type ChatwootSettingsView = {
  baseUrl: string
  accountId: string
  websiteToken: string
  hasApiToken: boolean
  hasHmacToken: boolean
  consent: ChatwootConsent
  identifyShoppers: boolean
  syncContacts: boolean
  cloud: boolean
  /** The chat widget shows on the storefront: an address and a website token. */
  chat: boolean
  /** Signed-in shoppers are identified: chat, the switch, and an HMAC token. */
  identifying: boolean
  /** Contacts sync and the Conversations cards work: an address, account id and API token. */
  api: boolean
  /** The account's dashboard, once an address and account id are saved. */
  dashboardUrl: string | null
}

export function chatwootSettingsView(settings: ChatwootSettings): ChatwootSettingsView {
  const baseUrl = normaliseChatwootUrl(settings.baseUrl)
  const chat = chatwootWidgetOf(settings) !== null
  return {
    baseUrl: settings.baseUrl,
    accountId: settings.accountId,
    websiteToken: settings.websiteToken,
    hasApiToken: settings.apiToken !== '',
    hasHmacToken: settings.hmacToken !== '',
    consent: settings.consent,
    identifyShoppers: settings.identifyShoppers,
    syncContacts: settings.syncContacts,
    cloud: baseUrl !== null && isChatwootCloud(baseUrl),
    chat,
    identifying: chat && settings.identifyShoppers && settings.hmacToken !== '',
    api: chatwootApiReady(settings),
    dashboardUrl:
      baseUrl && isAccountId(settings.accountId)
        ? chatwootLinks(baseUrl, settings.accountId).dashboard
        : null,
  }
}
