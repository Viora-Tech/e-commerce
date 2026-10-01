import 'server-only'

import { loadEnv, settingsSecret } from '@commerce/config'
import {
  appFor,
  type CustomerAccountSettings,
  type LoginApps,
  type LoginProvider,
  listCustomerIdentities,
  listCustomerPasskeys,
  loadCustomerAccountSettings,
  loadOwnLoginApps,
  loginReadiness,
  magicLinkIsLive,
  platformLoginApps,
  sessionLifetime,
  startCustomerSession,
} from '@commerce/core'
import { cookies, headers } from 'next/headers'
import { accountsOrigin } from './accounts-host'
import { writeCustomerToken } from './customer-session'
import { inStore } from './store-context'
import { originFromHost } from './store-resolver'

/*
 * Shared by the store-domain sign-in routes and actions and the platform login domain
 * (`ACCOUNTS_URL`, internal prefix `/-a`). Flow and security notes: developer docs,
 * "Shopper login options".
 */

/** Random value tying a provider sign-in to the browser that started it (store domain). */
export const LOGIN_BROWSER_COOKIE = 'wc_login_b'
/** OAuth state and PKCE verifier (platform login domain). */
export const OAUTH_COOKIE = 'wc_oauth'
/** A provider identity waiting for the shopper to confirm its email with a code. */
export const PENDING_LINK_COOKIE = 'wc_link'
/** The sealed WebAuthn challenge for the ceremony in progress. */
export const PASSKEY_COOKIE = 'wc_pk'
/** Truecaller request nonce for the browser that tapped the button. */
export const TRUECALLER_COOKIE = 'wc_tc'
/** One Tap nonce. */
export const ONE_TAP_COOKIE = 'wc_1tap'

/** What the platform login domain keeps in its cookie between the provider round trip. */
export type OAuthState = {
  /** OAuth `state`. */
  st: string
  /** PKCE code verifier. */
  cv: string
  /** The signed start request, re-checked on the way back. */
  q: string
  e: number
}

export const isDev = (): boolean => process.env.NODE_ENV !== 'production'

/** The provider's redirect URI: one per provider for every store. */
export const oauthCallbackUrl = (provider: LoginProvider): string =>
  `${accountsOrigin()}/oauth/${provider}/callback`

/** This request's public origin (`https://shop.example.in`, `http://waimers.localhost:3100`). */
export async function requestOrigin(): Promise<{ origin: string; hostname: string }> {
  const h = await headers()
  // The Host header, as the proxy used to pick the store (never x-forwarded-host).
  // The proxy already refused a Host that is not a plain host[:port]; checked again here
  // because this origin goes into emailed sign-in links.
  const parsed = originFromHost(h.get('host'), h.get('x-forwarded-proto'), isDev())
  if (!parsed) throw new Error('Unusable Host header')
  return parsed
}

export const cookieSecure = async (): Promise<boolean> =>
  (await headers()).get('x-forwarded-proto') === 'https' || !isDev()

/** The platform's apps (env) and the store's own ones (decrypted), with the settings. */
export async function storeLoginSetup(storeId: string): Promise<{
  settings: CustomerAccountSettings
  platform: LoginApps
  own: LoginApps
}> {
  const env = loadEnv(process.env)
  const previous = env.SETTINGS_SECRET_PREVIOUS?.split(',').filter(Boolean) ?? []
  return inStore(storeId, async (tx) => ({
    settings: await loadCustomerAccountSettings({ tx, storeId }),
    platform: platformLoginApps(env),
    own: await loadOwnLoginApps({ tx, storeId }, env.SETTINGS_SECRET, previous),
  }))
}

/** The app a switched-on provider uses for this store, or null. */
export async function storeLoginApp<P extends LoginProvider>(storeId: string, provider: P) {
  const { settings, platform, own } = await storeLoginSetup(storeId)
  return appFor(settings, platform, own, provider)
}

export async function storeReadiness(storeId: string) {
  const { platform, own } = await storeLoginSetup(storeId)
  return loginReadiness(platform, own)
}

/**
 * Sign the shopper in on this store's domain: a new session whose length follows
 * "Remember this device", in a host-only cookie. A session cookie (no expiry) when
 * the shopper chose not to be remembered.
 */
export async function signInCustomer(
  storeId: string,
  customerId: string,
  remember: boolean,
): Promise<void> {
  const settings = await inStore(storeId, (tx) => loadCustomerAccountSettings({ tx, storeId }))
  const life = sessionLifetime(settings.rememberDevice, remember)
  const session = await inStore(storeId, (tx) =>
    startCustomerSession({ tx, storeId }, customerId, new Date(), life.ttlMs),
  )
  await writeCustomerToken(session.token, session.expiresAt, life.persistent)
}

/** How long a new session lasts for this store and the shopper's choice. */
export async function lifetimeFor(storeId: string, remember: boolean) {
  const settings = await inStore(storeId, (tx) => loadCustomerAccountSettings({ tx, storeId }))
  return sessionLifetime(settings.rememberDevice, remember)
}

/** Read and forget a short-lived cookie. */
export async function takeCookie(name: string, path = '/'): Promise<string | null> {
  const jar = await cookies()
  const value = jar.get(name)?.value ?? null
  if (value) jar.set(name, '', { path, maxAge: 0 })
  return value
}

/** Whether a magic link can still be used (the landing page decides what to show). */
export async function magicLinkLive(storeId: string, token: unknown): Promise<boolean> {
  return inStore(storeId, (tx) => magicLinkIsLive({ tx, storeId }, token))
}

/** The account page's "Sign-in and security" data. Server only, never a server action. */
export async function securityOverview(storeId: string, customerId: string) {
  return inStore(storeId, async (tx) => ({
    passkeys: await listCustomerPasskeys({ tx, storeId }, customerId),
    identities: await listCustomerIdentities({ tx, storeId }, customerId),
  }))
}
