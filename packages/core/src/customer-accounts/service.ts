/** SOURCE OF TRUTH: customer account settings storage and sign-in availability — WHAT: read and save `store.preferences.customerAccounts`, and work out which sign-in methods (email, SMS, WhatsApp codes) the store's enabled notification apps can deliver right now / WHY: the merchant may only turn on methods their apps support, and the storefront must never offer a code it cannot send */
import { store } from '@commerce/db'
import type { NotificationChannel, NotificationRegistry } from '@commerce/notifications'
import { eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { storeNotificationChannels } from '../sender-email/channels'
import {
  type CustomerAccountSettings,
  CustomerAccountSettingsSchema,
  type LoginMethod,
  parseCustomerAccountSettings,
  unavailableLoginMethods,
} from './client'

export type LoginChannelDeps = {
  registry: NotificationRegistry
  settingsSecret: string
  /**
   * Whether the development log channels (email `log`, SMS `log-sms`) count.
   * True in development and tests, false in production, where a code printed
   * to a server console reaches nobody.
   */
  allowDevChannels: boolean
  /** Tests inject channels instead of resolving them from store settings. */
  channels?: NotificationChannel[] | undefined
}

const DEV_CHANNELS = new Set(['log', 'log-sms'])

/** How a channel delivers: email, SMS or WhatsApp. Phone channels without a medium are WhatsApp. */
function channelMethod(channel: NotificationChannel): LoginMethod {
  if (channel.requires === 'email') return 'email'
  return channel.medium === 'sms' ? 'sms' : 'whatsapp'
}

/** The store's channels that can carry a sign-in code by the given method. */
export async function loginChannels(
  ctx: StoreContext,
  method: LoginMethod,
  deps: LoginChannelDeps,
): Promise<NotificationChannel[]> {
  const channels =
    deps.channels ??
    (await storeNotificationChannels(ctx.tx, ctx.storeId, {
      registry: deps.registry,
      settingsSecret: deps.settingsSecret,
    }))
  return channels.filter(
    (c) => channelMethod(c) === method && (deps.allowDevChannels || !DEV_CHANNELS.has(c.id)),
  )
}

/** Sign-in methods the store can deliver now, in form order. */
export async function availableLoginMethods(
  ctx: StoreContext,
  deps: LoginChannelDeps,
): Promise<LoginMethod[]> {
  const out: LoginMethod[] = []
  for (const method of ['email', 'sms', 'whatsapp'] as const) {
    if ((await loginChannels(ctx, method, deps)).length > 0) out.push(method)
  }
  return out
}

export async function loadCustomerAccountSettings(
  ctx: StoreContext,
): Promise<CustomerAccountSettings> {
  const [s] = await ctx.tx
    .select({ preferences: store.preferences })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  return parseCustomerAccountSettings(s?.preferences)
}

export class LoginMethodUnavailable extends Error {
  constructor(readonly methods: LoginMethod[]) {
    super(`These sign-in methods need an app that can send them: ${methods.join(', ')}`)
    this.name = 'LoginMethodUnavailable'
  }
}

/**
 * Save the settings. A method the store cannot deliver is refused, so a
 * merchant cannot promise shoppers an SMS code with no SMS app. Other
 * preferences are left alone.
 */
export async function saveCustomerAccountSettings(
  ctx: StoreContext,
  input: unknown,
  available: readonly LoginMethod[],
): Promise<CustomerAccountSettings> {
  const customerAccounts = CustomerAccountSettingsSchema.parse(input)
  const missing = unavailableLoginMethods(customerAccounts, available)
  if (missing.length > 0) throw new LoginMethodUnavailable(missing)
  await ctx.tx
    .update(store)
    .set({
      preferences: sql`coalesce(${store.preferences}, '{}'::jsonb) || ${JSON.stringify({ customerAccounts })}::jsonb`,
    })
    .where(eq(store.id, ctx.storeId))
  return customerAccounts
}
