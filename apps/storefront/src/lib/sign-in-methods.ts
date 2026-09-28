import 'server-only'

import { loadEnv } from '@commerce/config'
import {
  appFor,
  availableLoginMethods,
  type CheckoutAccountMode,
  type LoginChannelDeps,
  type LoginMethod,
  loadCustomerAccountSettings,
  loginReadiness,
  type SignInOptions,
  signInOptions,
  usableLoginMethods,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import { storeLoginSetup } from './shopper-login'
import { inStore } from './store-context'

/** Outside production the console log channels count, and email codes are printed as before. */
export const devChannels = (): boolean => process.env.NODE_ENV !== 'production'

/** How the store's channels are resolved for sign-in and deletion codes. */
export async function codeChannelDeps(tx: StoreTx, storeId: string): Promise<LoginChannelDeps> {
  return {
    registry: (await registriesForStore(tx, storeId)).notifications,
    settingsSecret: loadEnv(process.env).SETTINGS_SECRET,
    allowDevChannels: devChannels(),
  }
}

/** Every method the store can deliver a code by right now. */
export async function deliverableMethods(tx: StoreTx, storeId: string): Promise<LoginMethod[]> {
  const methods = await availableLoginMethods({ tx, storeId }, await codeChannelDeps(tx, storeId))
  // In development an email code is printed to the console even with no email app.
  return devChannels() && !methods.includes('email') ? ['email', ...methods] : methods
}

export type StoreSignIn = {
  /** What the sign-in form offers, in order; never empty. */
  methods: LoginMethod[]
  checkout: CheckoutAccountMode
  /** Every enabled, working way to sign in (codes, providers, passkeys, magic link). */
  options: SignInOptions
  /** The store's own Google client id, for One Tap (only when One Tap is on). */
  oneTapClientId: string | null
}

/**
 * The sign-in methods the merchant chose that the store can send, and whether
 * checkout needs an account. Email stays as the last resort so no shopper is
 * ever shown an empty form (sending then says sign-in is unavailable).
 */
export async function storeSignIn(storeId: string): Promise<StoreSignIn> {
  const { platform, own } = await storeLoginSetup(storeId)
  return inStore(storeId, async (tx) => {
    const settings = await loadCustomerAccountSettings({ tx, storeId })
    const usable = usableLoginMethods(settings, await deliverableMethods(tx, storeId))
    const methods: LoginMethod[] = usable.length > 0 ? usable : ['email']
    const options = signInOptions(settings, methods, loginReadiness(platform, own))
    const google = options.oneTap ? appFor(settings, platform, own, 'google') : null
    return {
      methods,
      checkout: settings.checkout,
      options,
      oneTapClientId: google?.clientId ?? null,
    }
  })
}
