import { loadEnv } from '@commerce/config'
import {
  CaptureModeSchema,
  CheckoutMethodSchema,
  checkRateLimit,
  createMemoryRateLimitStore,
  MANUAL_ROW_IDS,
  MODE_GATEWAY_IDS,
  ONLINE_METHOD_IDS,
  PaymentAdjustmentSchema,
  PaymentMethodRulesSchema,
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
  paymentsTestMode,
  paymentTestOrderLink,
  razorpayRedirectUri,
  saveManualPaymentMethod,
  savePaymentCapture,
  savePaymentMethodRules,
  savePaymentMethods,
  savePaymentRouting,
  setPaymentGatewayActive,
  signOAuthState,
  skipPaymentSetup,
  switchPaymentMode,
  testPaymentConnection,
  verifyOAuthState,
} from '../services/payments-setup.service'
import { TEST_CONNECTION_RULE } from '../services/shipping.service'

/** Gateways the admin connects with pasted keys. */
const KEY_GATEWAYS = ['razorpay', 'cashfree'] as const

const ModeSchema = z.enum(['test', 'live'])

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

  /** For the admin-wide "Test mode" banner: a gateway at checkout runs on test keys. */
  testMode: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    return { testMode: await paymentsTestMode(context.tx, context.scope.storeId) }
  }),

  /** "Shoppers can pay with": on/off and order. Checkout follows. */
  saveMethods: can(permissions.PAYMENTS_MANAGE)
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

  /**
   * "Active providers" and "Route methods": which gateways are on together, their fallback
   * order, and which one takes each online method (audit #148/#150).
   */
  saveRouting: can(permissions.PAYMENTS_MANAGE)
    .input(
      z.object({
        order: z.array(z.enum(KEY_GATEWAYS)).max(8),
        methods: z.partialRecord(z.enum(ONLINE_METHOD_IDS), z.enum(KEY_GATEWAYS)).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { payments } = await storeRegistries(context.tx, context.scope.storeId)
      await savePaymentRouting(context.tx, context.scope.storeId, payments, paymentsEnv(), {
        order: input.order,
        methods: input.methods ?? {},
      })
      return { ok: true }
    }),

  /** "Payment rules" (#150): hide a way to pay by order total, PIN code or product. */
  saveMethodRules: can(permissions.PAYMENTS_MANAGE)
    .input(z.object({ rules: PaymentMethodRulesSchema }))
    .handler(async ({ context, input }) => {
      const { payments } = await storeRegistries(context.tx, context.scope.storeId)
      await savePaymentMethodRules(
        context.tx,
        context.scope.storeId,
        payments,
        paymentsEnv(),
        input.rules,
      )
      return { ok: true }
    }),

  /** "Payment capture" (#150): automatic, or authorise now and capture from the order page. */
  saveCapture: can(permissions.PAYMENTS_MANAGE)
    .input(z.object({ gatewayId: z.enum(KEY_GATEWAYS), mode: CaptureModeSchema }))
    .handler(async ({ context, input }) => {
      const { payments } = await storeRegistries(context.tx, context.scope.storeId)
      await savePaymentCapture(context.tx, context.scope.storeId, payments, paymentsEnv(), input)
      return { ok: true }
    }),

  /** One "Manual payment methods" row (UPI ID, bank transfer): details, on/off and note (#149). */
  saveManual: can(permissions.PAYMENTS_MANAGE)
    .input(
      z.object({
        kind: z.enum(MANUAL_ROW_IDS),
        on: z.boolean(),
        note: z.string().max(500),
        fields: z.record(z.string().max(32), z.string().max(200)),
        adjustment: PaymentAdjustmentSchema.nullable().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { payments } = await storeRegistries(context.tx, context.scope.storeId)
      await saveManualPaymentMethod(context.tx, context.scope.storeId, payments, paymentsEnv(), {
        kind: input.kind,
        on: input.on,
        note: input.note,
        fields: input.fields,
        adjustment: input.adjustment,
      })
      return { ok: true }
    }),

  /** Save pasted keys and make that gateway the main way to get paid. */
  connect: can(permissions.PAYMENTS_MANAGE)
    .input(
      z.object({
        providerId: z.enum(KEY_GATEWAYS),
        fields: z.record(z.string().max(64), z.string().max(4000)),
        /** Which of the two key sets these are; read from the keys when left out. */
        mode: ModeSchema.optional(),
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
        input.mode,
      )
      return { ok: true }
    }),

  /** Read-only key check for the Connect pages. Rate limited per store. */
  testConnection: can(permissions.SETTINGS_READ)
    .input(
      z.object({
        providerId: z.enum(KEY_GATEWAYS),
        fields: z.record(z.string().max(64), z.string().max(4000)),
        mode: ModeSchema.optional(),
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
        input.mode,
      )
    }),

  /**
   * The Live ⇄ Test switch on a gateway's card: swaps which saved key set
   * checkout uses, never deleting one. Going live runs the read-only key check
   * first, so it shares the test-connection rate limit.
   */
  switchMode: can(permissions.PAYMENTS_MANAGE)
    .input(z.object({ providerId: z.enum(MODE_GATEWAY_IDS), mode: ModeSchema }))
    .handler(async ({ context, input }) => {
      const limit = await checkRateLimit(
        context.rateLimit ?? fallbackRateLimit,
        rateLimitKey('payments-test-connection', context.scope.storeId),
        TEST_CONNECTION_RULE,
      )
      if (!limit.ok) throw tooMany(retryAfterSeconds(limit))
      const { payments } = await storeRegistries(context.tx, context.scope.storeId)
      if (!payments.get(input.providerId)) {
        throw new ORPCError('BAD_REQUEST', { message: 'Install this app from Apps first.' })
      }
      return switchPaymentMode(
        context.tx,
        context.scope.storeId,
        payments,
        paymentsEnv(),
        input.providerId,
        input.mode,
      )
    }),

  /** The Active/Inactive switch: off leaves checkout at once, keys and settings kept. */
  setActive: can(permissions.PAYMENTS_MANAGE)
    .input(z.object({ providerId: z.enum(MODE_GATEWAY_IDS), active: z.boolean() }))
    .handler(async ({ context, input }) => {
      const { payments } = await storeRegistries(context.tx, context.scope.storeId)
      return setPaymentGatewayActive(
        context.tx,
        context.scope.storeId,
        payments,
        input.providerId,
        input.active,
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
  fixWebhook: can(permissions.PAYMENTS_MANAGE).handler(async ({ context }) => {
    const { payments } = await storeRegistries(context.tx, context.scope.storeId)
    return fixRazorpayWebhook(context.tx, context.scope.storeId, payments, paymentsEnv())
  }),

  /** Where "Connect Razorpay" sends the merchant. Off unless the OAuth app is configured. */
  razorpayOAuthStart: can(permissions.PAYMENTS_MANAGE)
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
  razorpayOAuthComplete: can(permissions.PAYMENTS_MANAGE)
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
