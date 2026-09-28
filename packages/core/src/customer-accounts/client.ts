/** SOURCE OF TRUTH: customer account settings — WHAT: Settings → Customer accounts (guest checkout or sign-in required, and which sign-in methods shoppers get: email, SMS and WhatsApp codes, Google (with One Tap), Apple, Facebook, Truecaller, magic link, passkeys, "Remember this device") stored on `store.preferences.customerAccounts`, and which methods a store can actually offer given its notification apps / WHY: the admin page, the storefront sign-in form, checkout and the server actions must agree, and client code needs this without a database import */
import { z } from 'zod'

/*
 * Pure: `@commerce/core/customer-accounts`. What a store *can* offer depends
 * on its notification apps (an email app for email codes, WhatsApp for
 * WhatsApp codes, an SMS app for SMS codes); the server works that out in
 * `customer-accounts/service.ts` and passes it here as `available`.
 */

export const LOGIN_METHODS = ['email', 'sms', 'whatsapp'] as const
export type LoginMethod = (typeof LOGIN_METHODS)[number]

export const CHECKOUT_ACCOUNT_MODES = ['guest', 'account_required'] as const
export type CheckoutAccountMode = (typeof CHECKOUT_ACCOUNT_MODES)[number]

/** Sign in with a provider account through the platform login domain. */
export const SOCIAL_PROVIDERS = ['google', 'apple', 'facebook'] as const
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

/** Every provider a merchant can switch on, and bring their own app credentials for. */
export const LOGIN_PROVIDERS = [...SOCIAL_PROVIDERS, 'truecaller'] as const
export type LoginProvider = (typeof LOGIN_PROVIDERS)[number]

/** `platform`: the platform's own sign-in app (no setup). `own`: the merchant's credentials. */
export const CREDENTIAL_SOURCES = ['platform', 'own'] as const
export type CredentialSource = (typeof CREDENTIAL_SOURCES)[number]

const ProviderSwitchSchema = z.object({
  enabled: z.boolean().default(false),
  credentials: z.enum(CREDENTIAL_SOURCES).default('platform'),
})
export type ProviderSwitch = z.infer<typeof ProviderSwitchSchema>

export const CustomerAccountSettingsSchema = z.object({
  /** `guest`: anyone can check out, accounts are optional. `account_required`: sign in first. */
  checkout: z.enum(CHECKOUT_ACCOUNT_MODES).default('guest'),
  /** Sign-in methods the merchant turned on, in the order the form offers them. */
  loginMethods: z
    .array(z.enum(LOGIN_METHODS))
    .min(1, 'Turn on at least one way to sign in')
    .default(['email'])
    .transform((list) => LOGIN_METHODS.filter((m) => list.includes(m))),
  /** Google, Apple, Facebook and Truecaller: on or off, and whose app signs shoppers in. */
  providers: z
    .object({
      google: ProviderSwitchSchema.prefault({}),
      apple: ProviderSwitchSchema.prefault({}),
      facebook: ProviderSwitchSchema.prefault({}),
      truecaller: ProviderSwitchSchema.prefault({}),
    })
    .prefault({}),
  /** Google's "Continue as" prompt on the storefront. Needs Google on with the merchant's own app. */
  googleOneTap: z.boolean().default(false),
  /** "Email me a sign-in link" next to the email code. Needs email codes on. */
  magicLink: z.boolean().default(false),
  /** Sign in with a passkey (fingerprint, face or screen lock) once one is added. */
  passkeys: z.boolean().default(false),
  /** Show "Remember this device": ticked keeps the shopper signed in 90 days, unticked until the browser closes. */
  rememberDevice: z.boolean().default(false),
})
export type CustomerAccountSettings = z.infer<typeof CustomerAccountSettingsSchema>
export type CustomerAccountSettingsInput = z.input<typeof CustomerAccountSettingsSchema>

export const defaultCustomerAccountSettings: CustomerAccountSettings =
  CustomerAccountSettingsSchema.parse({})

/** The `customerAccounts` key of `store.preferences`, with defaults for anything missing or invalid. */
export function parseCustomerAccountSettings(preferences: unknown): CustomerAccountSettings {
  const raw =
    preferences && typeof preferences === 'object'
      ? (preferences as { customerAccounts?: unknown }).customerAccounts
      : undefined
  const r = CustomerAccountSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultCustomerAccountSettings
}

/**
 * The methods the sign-in form shows: the ones the merchant chose that the
 * store can send right now. If an app was switched off since and nothing
 * chosen is left, email still works when the store can send email, so no
 * shopper is locked out.
 */
export function usableLoginMethods(
  settings: Pick<CustomerAccountSettings, 'loginMethods'>,
  available: readonly LoginMethod[],
): LoginMethod[] {
  const usable = settings.loginMethods.filter((m) => available.includes(m))
  if (usable.length > 0) return usable
  return available.includes('email') ? ['email'] : []
}

/** Chosen methods the store cannot send any more; the admin page warns about them. */
export function unavailableLoginMethods(
  settings: Pick<CustomerAccountSettings, 'loginMethods'>,
  available: readonly LoginMethod[],
): LoginMethod[] {
  return settings.loginMethods.filter((m) => !available.includes(m))
}

/** Phone methods send the code to a mobile number; email sends it to an inbox. */
export function isPhoneMethod(method: LoginMethod): method is 'sms' | 'whatsapp' {
  return method !== 'email'
}

/** Whether a provider's app is set up: the platform's (env) and the merchant's own. */
export type ProviderReadiness = Record<LoginProvider, { platform: boolean; own: boolean }>

/** A switched-on provider can sign shoppers in only when the app it uses is set up. */
export function providerReady(
  settings: Pick<CustomerAccountSettings, 'providers'>,
  readiness: ProviderReadiness,
  provider: LoginProvider,
): boolean {
  const s = settings.providers[provider]
  if (!s.enabled) return false
  return s.credentials === 'own' ? readiness[provider].own : readiness[provider].platform
}

/** What the storefront sign-in page shows. Only enabled, working methods. */
export type SignInOptions = {
  /** Code methods, in order; never empty. */
  codes: LoginMethod[]
  /** Provider buttons, in order. */
  social: SocialProvider[]
  oneTap: boolean
  truecaller: boolean
  magicLink: boolean
  passkeys: boolean
  rememberDevice: boolean
}

/**
 * The storefront's sign-in options from the settings, the code methods the store can
 * send (`codes`, from `usableLoginMethods`) and which provider apps are set up. One Tap
 * needs the merchant's own Google app (their domain is listed on it); a magic link needs
 * email codes, because it goes to the same inbox.
 */
export function signInOptions(
  settings: CustomerAccountSettings,
  codes: readonly LoginMethod[],
  readiness: ProviderReadiness,
): SignInOptions {
  const social = SOCIAL_PROVIDERS.filter((p) => providerReady(settings, readiness, p))
  return {
    codes: codes.length > 0 ? [...codes] : ['email'],
    social,
    oneTap:
      settings.googleOneTap &&
      social.includes('google') &&
      settings.providers.google.credentials === 'own',
    truecaller: providerReady(settings, readiness, 'truecaller'),
    magicLink: settings.magicLink && codes.includes('email'),
    passkeys: settings.passkeys,
    rememberDevice: settings.rememberDevice,
  }
}

/** Providers switched on whose app is not set up; the admin page and save refuse them. */
export function providersNeedingSetup(
  settings: Pick<CustomerAccountSettings, 'providers'>,
  readiness: ProviderReadiness,
): LoginProvider[] {
  return LOGIN_PROVIDERS.filter(
    (p) => settings.providers[p].enabled && !providerReady(settings, readiness, p),
  )
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * How long a new session lasts. With "Remember this device" off (the default) nothing
 * changes: 30 days. With it on, a ticked box keeps the shopper signed in 90 days; an
 * unticked one ends the session when the browser closes (and after 12 hours at most).
 */
export function sessionLifetime(
  rememberDeviceOffered: boolean,
  remember: boolean,
): { ttlMs: number; persistent: boolean } {
  if (!rememberDeviceOffered) return { ttlMs: 30 * DAY_MS, persistent: true }
  return remember
    ? { ttlMs: 90 * DAY_MS, persistent: true }
    : { ttlMs: DAY_MS / 2, persistent: false }
}
