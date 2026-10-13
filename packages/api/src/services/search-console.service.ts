import {
  clearSearchConsoleRows,
  decryptSecret,
  encryptSecret,
  loadSearchConsoleEntry,
  saveSearchConsoleEntry,
  storefrontOriginFor,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  exchangeGoogleCode,
  type GoogleOAuthApp,
  type GoogleSitemap,
  googleAuthorizeUrl,
  refreshGoogleAccessToken,
  revokeGoogleToken,
  SearchConsoleError,
  searchConsoleClient,
  searchConsoleRedirectUri,
} from '@commerce/plugin-search-console/google'
import {
  pkceVerifier,
  signSearchConsoleState,
  syncSearchConsole,
  verifySearchConsoleState,
} from '@commerce/plugin-search-console/server'
import {
  defaultSearchConsoleSettings,
  isUsableSite,
  parseSearchConsoleSettings,
  REFRESH_COOLDOWN_MS,
  type SearchConsoleSettings,
  type SearchConsoleSite,
  type SearchConsoleView,
  searchConsoleView,
  sitemapUrlFor,
  suggestProperty,
} from '@commerce/plugin-search-console/settings'
import { ORPCError } from '@orpc/server'

/** The secrets and addresses the service needs from the environment. */
export type SearchConsoleEnv = {
  secret: string
  adminUrl: string
  /** `STOREFRONT_URL`, the fallback when the store has no live domain yet. */
  storefrontUrl: string
  /** The Google OAuth client, or null when this deployment has none. */
  app: GoogleOAuthApp | null
}

const badRequest = (message: string) => new ORPCError('BAD_REQUEST', { message })

async function load(tx: StoreTx, storeId: string) {
  const entry = await loadSearchConsoleEntry(tx, storeId)
  if (!entry.installed) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install Google Search Console first.' })
  }
  return { ...entry, settings: parseSearchConsoleSettings(entry.settings) }
}

function requireApp(env: SearchConsoleEnv): GoogleOAuthApp {
  if (!env.app) throw badRequest('Google Search Console is not set up on this platform yet.')
  return env.app
}

/** Google's own words for a refusal, as the admin's error; anything else is a real failure. */
function googleFailure(err: unknown): never {
  if (err instanceof SearchConsoleError) throw badRequest(err.message)
  throw err
}

/**
 * A Search Console API client on a fresh access token. A refusal is the admin's error; the
 * daily sync is what marks the app "connect again" (an error here rolls the request back).
 */
async function liveClient(settings: SearchConsoleSettings, env: SearchConsoleEnv) {
  const app = requireApp(env)
  if (!settings.refreshToken) throw badRequest('Connect Google Search Console first.')
  let refreshToken: string
  try {
    refreshToken = decryptSecret(settings.refreshToken, env.secret)
  } catch {
    throw badRequest(
      'The saved Google access can no longer be read. Connect Google Search Console again.',
    )
  }
  const accessToken = await refreshGoogleAccessToken(app, refreshToken).catch(googleFailure)
  return searchConsoleClient(accessToken)
}

export async function getSearchConsoleView(
  tx: StoreTx,
  storeId: string,
  env: SearchConsoleEnv,
): Promise<SearchConsoleView> {
  const { settings } = await load(tx, storeId)
  return searchConsoleView(settings, env.app !== null)
}

/** Where "Connect Google Search Console" sends the merchant: Google's consent screen. */
export async function startSearchConsoleConnect(
  tx: StoreTx,
  storeId: string,
  env: SearchConsoleEnv,
): Promise<{ url: string }> {
  await load(tx, storeId)
  const app = requireApp(env)
  const { state, nonce } = signSearchConsoleState(storeId, env.secret)
  return {
    url: googleAuthorizeUrl({
      clientId: app.clientId,
      redirectUri: searchConsoleRedirectUri(env.adminUrl),
      state,
      codeVerifier: pkceVerifier(nonce, env.secret),
    }),
  }
}

/**
 * Finish connecting: the `state` must be this store's and fresh, then the code is swapped for
 * tokens (with the PKCE verifier) and the refresh token saved encrypted. A new connection
 * starts with no property and no numbers; the merchant picks the property next.
 */
export async function completeSearchConsoleConnect(
  tx: StoreTx,
  storeId: string,
  env: SearchConsoleEnv,
  input: { code: string; state: string },
): Promise<SearchConsoleView> {
  const app = requireApp(env)
  const state = verifySearchConsoleState(input.state, env.secret)
  if (!state || state.storeId !== storeId) {
    throw badRequest('This link has expired. Try Connect again.')
  }
  const { settings } = await load(tx, storeId)
  const connection = await exchangeGoogleCode(app, {
    code: input.code,
    redirectUri: searchConsoleRedirectUri(env.adminUrl),
    codeVerifier: pkceVerifier(state.nonce, env.secret),
  }).catch(googleFailure)
  // A different account replaces the old grant: let Google drop it.
  if (settings.refreshToken) await revokeSaved(settings, env)
  const next: SearchConsoleSettings = {
    ...defaultSearchConsoleSettings,
    refreshToken: encryptSecret(connection.refreshToken, env.secret),
    email: connection.email,
    connectedAt: new Date().toISOString(),
  }
  await clearSearchConsoleRows(tx, storeId)
  await saveSearchConsoleEntry(tx, storeId, next)
  return searchConsoleView(next, true)
}

async function revokeSaved(settings: SearchConsoleSettings, env: SearchConsoleEnv) {
  try {
    await revokeGoogleToken(decryptSecret(settings.refreshToken, env.secret))
  } catch {
    // Unreadable under the current secret: nothing we can revoke; Google expires it unused.
  }
}

/** Ends the grant at Google and forgets the token, the property and every stored number. */
export async function disconnectSearchConsole(
  tx: StoreTx,
  storeId: string,
  env: SearchConsoleEnv,
): Promise<SearchConsoleView> {
  const { settings } = await load(tx, storeId)
  if (settings.refreshToken) await revokeSaved(settings, env)
  await clearSearchConsoleRows(tx, storeId)
  await saveSearchConsoleEntry(tx, storeId, defaultSearchConsoleSettings)
  return searchConsoleView(defaultSearchConsoleSettings, env.app !== null)
}

export type SearchConsoleProperties = {
  properties: (SearchConsoleSite & { usable: boolean })[]
  /** The property matching the store's live domain, to pre-select. */
  suggested: string | null
  /** The store's live domains, primary first, for the "add your domain in Search Console" hint. */
  hostnames: string[]
}

/** Every property the connected account can see, and the one that matches the store. */
export async function listSearchConsoleProperties(
  tx: StoreTx,
  storeId: string,
  env: SearchConsoleEnv,
): Promise<SearchConsoleProperties> {
  const { settings, hostnames } = await load(tx, storeId)
  const client = await liveClient(settings, env)
  const sites = await client.sites().catch(googleFailure)
  return {
    properties: sites
      .map((s) => ({ ...s, usable: isUsableSite(s) }))
      .sort((a, b) => a.siteUrl.localeCompare(b.siteUrl)),
    suggested: suggestProperty(sites, hostnames),
    hostnames,
  }
}

/** Saves the property (it must be one the account can read), drops the old numbers and pulls new ones. */
export async function chooseSearchConsoleProperty(
  tx: StoreTx,
  storeId: string,
  env: SearchConsoleEnv,
  property: string,
): Promise<SearchConsoleView> {
  const { settings } = await load(tx, storeId)
  const client = await liveClient(settings, env)
  const site = (await client.sites().catch(googleFailure)).find((s) => s.siteUrl === property)
  if (!site || !isUsableSite(site)) {
    throw badRequest('This Google account cannot read that property. Pick another one.')
  }
  const next: SearchConsoleSettings = {
    ...settings,
    property,
    syncedAt: '',
    attemptedAt: '',
    lastError: '',
    ranges: null,
  }
  await clearSearchConsoleRows(tx, storeId)
  await saveSearchConsoleEntry(tx, storeId, next)
  await syncNow(tx, storeId, env)
  return getSearchConsoleView(tx, storeId, env)
}

/** The sync, inside this request's transaction (a failure is saved on the app, not thrown). */
function syncNow(tx: StoreTx, storeId: string, env: SearchConsoleEnv) {
  return syncSearchConsole({
    storeId,
    inStore: (fn) => fn(tx),
    secret: env.secret,
    app: env.app,
  })
}

/** "Refresh now": the same sync as the worker's, at most once per cooldown. */
export async function refreshSearchConsole(
  tx: StoreTx,
  storeId: string,
  env: SearchConsoleEnv,
  now: Date = new Date(),
): Promise<SearchConsoleView> {
  const { settings } = await load(tx, storeId)
  if (!settings.refreshToken || !settings.property) {
    throw badRequest('Connect Google Search Console and pick a property first.')
  }
  const last = Date.parse(settings.refreshedAt)
  if (Number.isFinite(last) && now.getTime() - last < REFRESH_COOLDOWN_MS) {
    const minutes = Math.ceil((last + REFRESH_COOLDOWN_MS - now.getTime()) / 60_000)
    throw new ORPCError('TOO_MANY_REQUESTS', {
      message: `Refreshed a moment ago. Try again in about ${minutes} minute(s).`,
    })
  }
  await saveSearchConsoleEntry(tx, storeId, { ...settings, refreshedAt: now.toISOString() })
  await syncNow(tx, storeId, env)
  return getSearchConsoleView(tx, storeId, env)
}

/** One sitemap as the Sitemaps page lists it. */
export type SearchConsoleSitemap = {
  url: string
  lastSubmitted: string | null
  lastDownloaded: string | null
  pending: boolean
  warnings: number
  errors: number
  /** Web pages Google found in it. */
  submitted: number
}

const count = (value: string | undefined) => Number(value ?? 0) || 0

const toSitemap = (s: GoogleSitemap): SearchConsoleSitemap => ({
  url: s.path ?? '',
  lastSubmitted: s.lastSubmitted ?? null,
  lastDownloaded: s.lastDownloaded ?? null,
  pending: s.isPending === true,
  warnings: count(s.warnings),
  errors: count(s.errors),
  submitted: (s.contents ?? []).reduce((n, c) => n + count(c.submitted), 0),
})

async function ourSitemap(
  tx: StoreTx,
  storeId: string,
  env: SearchConsoleEnv,
  settings: SearchConsoleSettings,
  hostnames: string[],
): Promise<string> {
  const origin = await storefrontOriginFor(tx, storeId, env.storefrontUrl)
  return sitemapUrlFor(settings.property, hostnames, origin)
}

/** The property's sitemaps as Google lists them, and the one this store publishes. */
export async function searchConsoleSitemaps(
  tx: StoreTx,
  storeId: string,
  env: SearchConsoleEnv,
): Promise<{ sitemaps: SearchConsoleSitemap[]; ours: string; property: string }> {
  const { settings, hostnames } = await load(tx, storeId)
  if (!settings.property) throw badRequest('Pick a Search Console property first.')
  const client = await liveClient(settings, env)
  const listed = await client.sitemaps(settings.property).catch(googleFailure)
  return {
    sitemaps: listed.map(toSitemap).filter((s) => s.url),
    ours: await ourSitemap(tx, storeId, env, settings, hostnames),
    property: settings.property,
  }
}

/** Tells Google about the store's sitemap (`/sitemap.xml`, every live product, collection and page). */
export async function submitSearchConsoleSitemap(
  tx: StoreTx,
  storeId: string,
  env: SearchConsoleEnv,
): Promise<{ url: string }> {
  const { settings, hostnames } = await load(tx, storeId)
  if (!settings.property) throw badRequest('Pick a Search Console property first.')
  const client = await liveClient(settings, env)
  const url = await ourSitemap(tx, storeId, env, settings, hostnames)
  await client.submitSitemap(settings.property, url).catch(googleFailure)
  return { url }
}
