import { loadEnv, settingsSecret } from '@commerce/config'
import {
  availableLoginMethods,
  CustomerAccountSettingsSchema,
  LOGIN_APP_FIELDS,
  LOGIN_PROVIDERS,
  LoginAppIncomplete,
  LoginMethodUnavailable,
  LoginProviderNeedsSetup,
  loadCustomerAccountSettings,
  loadOwnLoginApps,
  loginReadiness,
  maskedOwnLoginApps,
  permissions,
  platformLoginApps,
  providersNeedingSetup,
  removeOwnLoginApp,
  saveCustomerAccountSettings,
  saveOwnLoginApp,
  unavailableLoginMethods,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { storeRegistries } from '../services/apps.service'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

const ctxOf = (context: Ctx) => ({ tx: context.tx, storeId: context.scope.storeId })

/** Sign-in methods the store's notification apps can deliver right now. */
async function available(context: Ctx) {
  const { notifications } = await storeRegistries(context.tx, context.scope.storeId)
  return availableLoginMethods(ctxOf(context), {
    registry: notifications,
    settingsSecret: settingsSecret(),
    // The console log channels reach nobody on a live store.
    allowDevChannels: process.env.NODE_ENV !== 'production',
  })
}

const secrets = () => {
  const env = loadEnv(process.env)
  return {
    env,
    secret: env.SETTINGS_SECRET,
    previous: env.SETTINGS_SECRET_PREVIOUS?.split(',').filter(Boolean) ?? [],
  }
}

/** Which provider apps are set up: the platform's (env) and the store's own. */
async function readiness(context: Ctx) {
  const { env, secret, previous } = secrets()
  return loginReadiness(
    platformLoginApps(env),
    await loadOwnLoginApps(ctxOf(context), secret, previous),
  )
}

/** The platform login domain and the redirect URIs a merchant's own app must list. */
function loginDomain() {
  const env = loadEnv(process.env)
  const accounts = new URL(env.ACCOUNTS_URL ?? `https://accounts.${env.PLATFORM_STORE_DOMAIN}`)
    .origin
  return {
    accountsUrl: accounts,
    callbacks: {
      google: `${accounts}/oauth/google/callback`,
      apple: `${accounts}/oauth/apple/callback`,
      facebook: `${accounts}/oauth/facebook/callback`,
      truecaller: `${accounts}/truecaller/callback`,
    },
  }
}

const ProviderInput = z.enum(LOGIN_PROVIDERS)

/** Settings → Customer accounts: guest checkout and every way to sign in. */
export const customerAccountsRouter = {
  get: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const settings = await loadCustomerAccountSettings(ctxOf(context))
    const methods = await available(context)
    const ready = await readiness(context)
    const { secret, previous } = secrets()
    return {
      settings,
      available: methods,
      /** Chosen methods whose app was switched off since; the page warns about them. */
      unavailable: unavailableLoginMethods(settings, methods),
      /** Per provider: is the platform's app set up, has the merchant added their own. */
      readiness: ready,
      /** Switched-on providers whose app is missing; shoppers do not see them. */
      needsSetup: providersNeedingSetup(settings, ready),
      /** The merchant's own apps, secrets masked. */
      ownApps: await maskedOwnLoginApps(ctxOf(context), secret, previous),
      fields: LOGIN_APP_FIELDS,
      ...loginDomain(),
    }
  }),

  save: can(permissions.SETTINGS_MANAGE)
    .input(CustomerAccountSettingsSchema)
    .handler(async ({ context, input }) => {
      try {
        return await saveCustomerAccountSettings(
          ctxOf(context),
          input,
          await available(context),
          await readiness(context),
        )
      } catch (error) {
        if (error instanceof LoginMethodUnavailable || error instanceof LoginProviderNeedsSetup) {
          throw new ORPCError('BAD_REQUEST', { message: error.message })
        }
        throw error
      }
    }),

  /** Save the merchant's own Google / Apple / Facebook / Truecaller app. Secrets are encrypted. */
  saveApp: can(permissions.SETTINGS_MANAGE)
    .input(
      z.object({
        provider: ProviderInput,
        fields: z.record(z.string(), z.string().max(8000)),
      }),
    )
    .handler(async ({ context, input }) => {
      try {
        await saveOwnLoginApp(ctxOf(context), input.provider, input.fields, secrets().secret)
      } catch (error) {
        if (error instanceof LoginAppIncomplete) {
          throw new ORPCError('BAD_REQUEST', { message: error.message })
        }
        throw error
      }
      return { ok: true as const }
    }),

  removeApp: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ provider: ProviderInput }))
    .handler(async ({ context, input }) => {
      await removeOwnLoginApp(ctxOf(context), input.provider)
      return { ok: true as const }
    }),
}
