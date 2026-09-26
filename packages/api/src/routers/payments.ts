import { loadEnv } from '@commerce/config'
import {
  CheckoutMethodSchema,
  checkRateLimit,
  createMemoryRateLimitStore,
  parsePreviousSecrets,
  permissions,
  rateLimitKey,
  refreshPaymentCredentials,
  retryAfterSeconds,
} from '@commerce/core'
import { razorpayAuthorizeUrl, razorpayOAuthApp } from '@commerce/payments-razorpay'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { getStoreApps, storeRegistries } from '../services/apps.service'
import {
  completeRazorpayOAuth,
  connectPaymentGateway,
  fixRazorpayWebhook,
  type PaymentsEnv,
  paymentsSetup,
  paymentTestOrderLink,
  razorpayRedirectUri,
  savePaymentMethods,
  signOAuthState,
  skipPaymentSetup,
  testPaymentConnection,
  verifyOAuthState,
} from '../services/payments-setup.service'
import { TEST_CONNECTION_RULE } from '../services/shipping.service'

/** Gateways the admin connects with pasted keys. */
const KEY_GATEWAYS = ['razorpay', 'cashfree'] as const

function paymentsEnv(): PaymentsEnv & { adminUrl: string } {
  const env = loadEnv(process.env)
  return {
    secret: env.SETTINGS_SECRET,
    previousSecrets: parsePreviousSecrets(env.SETTINGS_SECRET_PREVIOUS),
    workerUrl: process.env.NEXT_PUBLIC_WORKER_URL ?? `http://localhost:${env.WORKER_PORT}`,
    storefrontUrl: env.STOREFRONT_URL,
    adminUrl: env.ADMIN_URL,
    razorpayOAuth: razorpayOAuthApp(process.env) !== null,
  }
}

/** See `store.testDelhiveryConnection`: a store can't hammer a gateway with guessed keys. */
const fallbackRateLimit = createMemoryRateLimitStore()

const tooMany = (seconds: number) =>
  new ORPCError('TOO_MANY_REQUESTS', {
    message: `Too many attempts. Try again in about ${Math.ceil(seconds / 60)} minute(s).`,
  })

export const paymentsRouter = {
  /** Everything Settings → Payments and the first-time setup show. Renews OAuth tokens when due. */
  setup: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const { storeId } = context.scope
    const env = paymentsEnv()
    const { payments } = await storeRegistries(context.tx, storeId)
    await refreshPaymentCredentials(
      { storeId, tx: context.tx },
      payments,
      env.secret,
      env.previousSecrets,
    )
    const apps = await getStoreApps(context.tx, storeId)
    return paymentsSetup(context.tx, storeId, payments, apps.installed, env)
  }),

  /** "Shoppers can pay with": on/off and order. Checkout follows. */
  saveMethods: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ methods: z.array(CheckoutMethodSchema).max(12) }))
    .handler(async ({ context, input }) => {
      const { payments } = await storeRegistries(context.tx, context.scope.storeId)
      await savePaymentMethods(
        context.tx,
        context.scope.storeId,
        payments,
        paymentsEnv(),
        input.methods,
      )
      return { ok: true }
    }),

  /** Save pasted keys and make that gateway the main way to get paid. */
  connect: can(permissions.SETTINGS_MANAGE)
    .input(
      z.object({
        providerId: z.enum(KEY_GATEWAYS),
        fields: z.record(z.string().max(64), z.string().max(4000)),
      }),
    )
    .handler(async ({ context, input }) => {
      const { payments } = await storeRegistries(context.tx, context.scope.storeId)
      if (!payments.get(input.providerId)) {
        throw new ORPCError('BAD_REQUEST', { message: 'Install this app from Apps first.' })
      }
      await connectPaymentGateway(
        context.tx,
        context.scope.storeId,
        payments,
        paymentsEnv(),
        input.providerId,
        input.fields,
      )
      return { ok: true }
    }),

  /** Read-only key check for the Connect pages. Rate limited per store. */
  testConnection: can(permissions.SETTINGS_READ)
    .input(
      z.object({
        providerId: z.enum(KEY_GATEWAYS),
        fields: z.record(z.string().max(64), z.string().max(4000)),
      }),
    )
    .handler(async ({ context, input }) => {
      const limit = await checkRateLimit(
        context.rateLimit ?? fallbackRateLimit,
        rateLimitKey('payments-test-connection', context.scope.storeId),
        TEST_CONNECTION_RULE,
      )
      if (!limit.ok) throw tooMany(retryAfterSeconds(limit))
      const { payments } = await storeRegistries(context.tx, context.scope.storeId)
      return testPaymentConnection(
        context.tx,
        context.scope.storeId,
        payments,
        paymentsEnv(),
        input.providerId,
        input.fields,
      )
    }),

  skipSetup: can(permissions.SETTINGS_MANAGE).handler(async ({ context }) => {
    const { payments } = await storeRegistries(context.tx, context.scope.storeId)
    await skipPaymentSetup(context.tx, context.scope.storeId, payments, paymentsEnv())
    return { ok: true }
  }),

  /** "Place a test order": a signed storefront link with only the ₹1 test product in the basket. */
  testOrderLink: can(permissions.SETTINGS_MANAGE).handler(async ({ context }) => ({
    url: await paymentTestOrderLink(context.tx, context.scope.storeId, paymentsEnv()),
  })),

  /** The health line's "Fix" for payment updates on a Connect Razorpay account. */
  fixWebhook: can(permissions.SETTINGS_MANAGE).handler(async ({ context }) => {
    const { payments } = await storeRegistries(context.tx, context.scope.storeId)
    return fixRazorpayWebhook(context.tx, context.scope.storeId, payments, paymentsEnv())
  }),

  /** Where "Connect Razorpay" sends the merchant. Off unless the OAuth app is configured. */
  razorpayOAuthStart: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ mode: z.enum(['test', 'live']) }))
    .handler(({ context, input }) => {
      const app = razorpayOAuthApp(process.env)
      if (!app)
        throw new ORPCError('BAD_REQUEST', { message: 'Connect Razorpay is not set up here.' })
      const env = paymentsEnv()
      const state = signOAuthState({ storeId: context.scope.storeId, mode: input.mode }, env.secret)
      return {
        url: razorpayAuthorizeUrl({
          clientId: app.clientId,
          redirectUri: razorpayRedirectUri(env.adminUrl),
          state,
        }),
      }
    }),

  /** The OAuth callback route hands the code here; the state must be this store's, and fresh. */
  razorpayOAuthComplete: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ code: z.string().min(1).max(2000), state: z.string().min(1).max(2000) }))
    .handler(async ({ context, input }) => {
      const app = razorpayOAuthApp(process.env)
      if (!app)
        throw new ORPCError('BAD_REQUEST', { message: 'Connect Razorpay is not set up here.' })
      const env = paymentsEnv()
      const state = verifyOAuthState(input.state, env.secret)
      if (!state || state.storeId !== context.scope.storeId) {
        throw new ORPCError('BAD_REQUEST', { message: 'This link has expired. Try Connect again.' })
      }
      const { payments } = await storeRegistries(context.tx, context.scope.storeId)
      return completeRazorpayOAuth(context.tx, context.scope.storeId, payments, env, app, {
        code: input.code,
        mode: state.mode,
        redirectUri: razorpayRedirectUri(env.adminUrl),
      })
    }),
}
