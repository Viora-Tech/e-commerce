/** SOURCE OF TRUTH: shopper sign-in app credentials — WHAT: the platform's own Google / Apple / Facebook / Truecaller apps (from env) and a merchant's own ones (store.login_providers, secret fields encrypted, masked for the admin), which app each switched-on provider uses, and whether it is ready / WHY: most merchants use the platform's apps with no setup, some want their own brand on the Google or Apple consent screen, and a secret must never be stored or shown in clear */
import { store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { StoreContext } from '../context'
import {
  type CustomerAccountSettings,
  LOGIN_PROVIDERS,
  type LoginProvider,
  type ProviderReadiness,
} from '../customer-accounts/client'
import {
  decryptProviderSettings,
  encryptProviderSettings,
  isMaskedSecret,
  maskProviderSettings,
  type ProviderSettings,
} from '../settings/secrets'

export type LoginAppField = { key: string; secret?: boolean; multiline?: boolean }

/** What each provider's app needs. Labels and help live in the admin's copy. */
export const LOGIN_APP_FIELDS: Record<LoginProvider, LoginAppField[]> = {
  google: [{ key: 'clientId' }, { key: 'clientSecret', secret: true }],
  apple: [
    { key: 'servicesId' },
    { key: 'teamId' },
    { key: 'keyId' },
    { key: 'privateKey', secret: true, multiline: true },
  ],
  facebook: [{ key: 'appId' }, { key: 'appSecret', secret: true }],
  truecaller: [{ key: 'partnerKey' }, { key: 'partnerName' }],
}

export type GoogleApp = { provider: 'google'; clientId: string; clientSecret: string }
export type AppleApp = {
  provider: 'apple'
  servicesId: string
  teamId: string
  keyId: string
  privateKey: string
}
export type FacebookApp = { provider: 'facebook'; appId: string; appSecret: string }
export type TruecallerApp = { provider: 'truecaller'; partnerKey: string; partnerName: string }
export type LoginApp = GoogleApp | AppleApp | FacebookApp | TruecallerApp
export type LoginApps = { [P in LoginProvider]?: Extract<LoginApp, { provider: P }> }

/** Env keys `@commerce/config` declares for the platform's apps. */
export type PlatformLoginEnv = {
  SHOPPER_GOOGLE_CLIENT_ID?: string | undefined
  SHOPPER_GOOGLE_CLIENT_SECRET?: string | undefined
  SHOPPER_APPLE_SERVICES_ID?: string | undefined
  SHOPPER_APPLE_TEAM_ID?: string | undefined
  SHOPPER_APPLE_KEY_ID?: string | undefined
  SHOPPER_APPLE_PRIVATE_KEY?: string | undefined
  SHOPPER_FACEBOOK_APP_ID?: string | undefined
  SHOPPER_FACEBOOK_APP_SECRET?: string | undefined
  SHOPPER_TRUECALLER_PARTNER_KEY?: string | undefined
  SHOPPER_TRUECALLER_PARTNER_NAME?: string | undefined
}

/** A .p8 key pasted into one env line keeps its line breaks as `\n`. */
const pem = (value: string): string => value.replace(/\\n/g, '\n').trim()

/** The platform's apps: each one only when all its keys are set. */
export function platformLoginApps(env: PlatformLoginEnv): LoginApps {
  const apps: LoginApps = {}
  if (env.SHOPPER_GOOGLE_CLIENT_ID && env.SHOPPER_GOOGLE_CLIENT_SECRET) {
    apps.google = {
      provider: 'google',
      clientId: env.SHOPPER_GOOGLE_CLIENT_ID,
      clientSecret: env.SHOPPER_GOOGLE_CLIENT_SECRET,
    }
  }
  if (
    env.SHOPPER_APPLE_SERVICES_ID &&
    env.SHOPPER_APPLE_TEAM_ID &&
    env.SHOPPER_APPLE_KEY_ID &&
    env.SHOPPER_APPLE_PRIVATE_KEY
  ) {
    apps.apple = {
      provider: 'apple',
      servicesId: env.SHOPPER_APPLE_SERVICES_ID,
      teamId: env.SHOPPER_APPLE_TEAM_ID,
      keyId: env.SHOPPER_APPLE_KEY_ID,
      privateKey: pem(env.SHOPPER_APPLE_PRIVATE_KEY),
    }
  }
  if (env.SHOPPER_FACEBOOK_APP_ID && env.SHOPPER_FACEBOOK_APP_SECRET) {
    apps.facebook = {
      provider: 'facebook',
      appId: env.SHOPPER_FACEBOOK_APP_ID,
      appSecret: env.SHOPPER_FACEBOOK_APP_SECRET,
    }
  }
  if (env.SHOPPER_TRUECALLER_PARTNER_KEY && env.SHOPPER_TRUECALLER_PARTNER_NAME) {
    apps.truecaller = {
      provider: 'truecaller',
      partnerKey: env.SHOPPER_TRUECALLER_PARTNER_KEY,
      partnerName: env.SHOPPER_TRUECALLER_PARTNER_NAME,
    }
  }
  return apps
}

const StoredSchema = z.object({
  enabled: z.array(z.string()).default([]),
  providers: z.record(z.string(), z.record(z.string(), z.string())).default({}),
})

const secretFieldsOf = (id: string) => LOGIN_APP_FIELDS[id as LoginProvider]

function parseStored(raw: unknown): ProviderSettings {
  const r = StoredSchema.safeParse(raw ?? {})
  return r.success ? r.data : { enabled: [], providers: {} }
}

/** Build a typed app from plain fields, or null when a field is missing. */
export function loginAppFrom(
  provider: LoginProvider,
  fields: Record<string, string> | undefined,
): LoginApp | null {
  if (!fields) return null
  const values: Record<string, string> = {}
  for (const f of LOGIN_APP_FIELDS[provider]) {
    const v = fields[f.key]?.trim()
    if (!v) return null
    values[f.key] = f.multiline ? pem(v) : v
  }
  return { provider, ...values } as LoginApp
}

/** The merchant's own apps, decrypted. Server only; never send the result to a browser. */
export async function loadOwnLoginApps(
  ctx: StoreContext,
  secret: string,
  previousSecrets: string[] = [],
): Promise<LoginApps> {
  const [row] = await ctx.tx
    .select({ loginProviders: store.loginProviders })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const plain = decryptProviderSettings(parseStored(row?.loginProviders), secret, previousSecrets)
  const apps: LoginApps = {}
  for (const p of LOGIN_PROVIDERS) {
    const app = loginAppFrom(p, plain.providers[p])
    if (app) (apps as Record<string, LoginApp>)[p] = app
  }
  return apps
}

/** The merchant's own apps with secrets masked (`••••abcd`), for the admin form. */
export async function maskedOwnLoginApps(
  ctx: StoreContext,
  secret: string,
  previousSecrets: string[] = [],
): Promise<Partial<Record<LoginProvider, Record<string, string>>>> {
  const [row] = await ctx.tx
    .select({ loginProviders: store.loginProviders })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const plain = decryptProviderSettings(parseStored(row?.loginProviders), secret, previousSecrets)
  return maskProviderSettings(plain, secretFieldsOf).providers
}

export class LoginAppIncomplete extends Error {
  constructor(readonly missing: string[]) {
    super(`Fill in: ${missing.join(', ')}`)
    this.name = 'LoginAppIncomplete'
  }
}

/**
 * Save the merchant's own app for one provider. A masked secret sent back unchanged
 * keeps the stored one. Secret fields are encrypted before they reach the row.
 */
export async function saveOwnLoginApp(
  ctx: StoreContext,
  provider: LoginProvider,
  input: Record<string, unknown>,
  secret: string,
): Promise<void> {
  const [row] = await ctx.tx
    .select({ loginProviders: store.loginProviders })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const stored = parseStored(row?.loginProviders)
  const before = stored.providers[provider] ?? {}
  const next: Record<string, string> = {}
  const missing: string[] = []
  for (const f of LOGIN_APP_FIELDS[provider]) {
    const raw = input[f.key]
    const value = typeof raw === 'string' ? raw.trim().slice(0, 8000) : ''
    const kept = isMaskedSecret(value) ? (before[f.key] ?? '') : value
    if (!kept) missing.push(f.key)
    next[f.key] = kept
  }
  if (missing.length > 0) throw new LoginAppIncomplete(missing)
  const merged: ProviderSettings = {
    enabled: [...new Set([...stored.enabled, provider])],
    providers: { ...stored.providers, [provider]: next },
  }
  await ctx.tx
    .update(store)
    .set({ loginProviders: encryptProviderSettings(merged, secret, secretFieldsOf) })
    .where(eq(store.id, ctx.storeId))
}

/** Forget the merchant's own app for one provider. */
export async function removeOwnLoginApp(ctx: StoreContext, provider: LoginProvider): Promise<void> {
  const [row] = await ctx.tx
    .select({ loginProviders: store.loginProviders })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const stored = parseStored(row?.loginProviders)
  const { [provider]: _gone, ...rest } = stored.providers
  await ctx.tx
    .update(store)
    .set({
      loginProviders: { enabled: stored.enabled.filter((p) => p !== provider), providers: rest },
    })
    .where(eq(store.id, ctx.storeId))
}

/** Which apps are set up, per provider. */
export function loginReadiness(platform: LoginApps, own: LoginApps): ProviderReadiness {
  const out = {} as ProviderReadiness
  for (const p of LOGIN_PROVIDERS) out[p] = { platform: Boolean(platform[p]), own: Boolean(own[p]) }
  return out
}

/** The app a switched-on provider signs in with, or null (off, or its app is not set up). */
export function appFor<P extends LoginProvider>(
  settings: Pick<CustomerAccountSettings, 'providers'>,
  platform: LoginApps,
  own: LoginApps,
  provider: P,
): Extract<LoginApp, { provider: P }> | null {
  const s = settings.providers[provider]
  if (!s.enabled) return null
  return ((s.credentials === 'own' ? own[provider] : platform[provider]) ?? null) as Extract<
    LoginApp,
    { provider: P }
  > | null
}
