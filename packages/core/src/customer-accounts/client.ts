/** SOURCE OF TRUTH: customer account settings — WHAT: Settings → Customer accounts (guest checkout or sign-in required, and which sign-in methods shoppers get: email code, SMS code, WhatsApp code) stored on `store.preferences.customerAccounts`, and which methods a store can actually offer given its notification apps / WHY: the admin page, the storefront sign-in form, checkout and the server actions must agree, and client code needs this without a database import */
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

export const CustomerAccountSettingsSchema = z.object({
  /** `guest`: anyone can check out, accounts are optional. `account_required`: sign in first. */
  checkout: z.enum(CHECKOUT_ACCOUNT_MODES).default('guest'),
  /** Sign-in methods the merchant turned on, in the order the form offers them. */
  loginMethods: z
    .array(z.enum(LOGIN_METHODS))
    .min(1, 'Turn on at least one way to sign in')
    .default(['email'])
    .transform((list) => LOGIN_METHODS.filter((m) => list.includes(m))),
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
