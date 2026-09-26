import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  type CheckoutMethod,
  checkoutMethodsOf,
  createPaymentTestCart,
  DEFAULT_CHECKOUT_METHODS,
  decryptPaymentSettings,
  enabledForMethods,
  GATEWAY_PROVIDER_IDS,
  isGatewayProvider,
  isMaskedSecret,
  onlineMethodsOn,
  type PaymentRegistry,
  type PaymentSettings,
  parsePaymentSettings,
  recoveryUrl,
} from '@commerce/core'
import { getRegistries } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import { payment, paymentEvent, store } from '@commerce/db'
import type { ConnectionTestResult } from '@commerce/payments'
import {
  exchangeRazorpayCode,
  oauthConfigFields,
  type RazorpayOAuthApp,
  registerRazorpayWebhook,
  updateRazorpayWebhook,
} from '@commerce/payments-razorpay'
import { and, desc, eq, inArray } from 'drizzle-orm'
import {
  availableProviders,
  prepareProviderSettings,
  presentProviderSettings,
} from './provider-settings'
import { updateStorePayments } from './store.service'

/** What the setup service needs from the host, so tests pass their own. */
export type PaymentsEnv = {
  secret: string
  previousSecrets: string[]
  /** Public worker URL, where gateways post payment updates. */
  workerUrl: string
  storefrontUrl: string
  /** True when RAZORPAY_OAUTH_CLIENT_ID and _SECRET are set. */
  razorpayOAuth: boolean
}

/** A payment went through recently but no gateway update arrived for this long after it. */
const WEBHOOK_GRACE_MS = 15 * 60_000
const WEBHOOK_LOOKBACK_MS = 14 * 24 * 60 * 60_000

export type PaymentProblem =
  /** Payments are captured but the gateway's updates (webhook) never reach us. */
  | { code: 'webhook_silent'; fix: 'reregister' | 'dashboard' }
  /** The "Connect Razorpay" access could not be renewed; the merchant reconnects. */
  | { code: 'reconnect' }
  /** Keys missing or malformed. */
  | { code: 'config_invalid'; detail: string }
  /** Every online method is off, so the gateway is connected but unused. */
  | { code: 'no_online_methods' }

export type GatewayStatus = {
  id: string
  label: string
  mode: 'test' | 'live' | null
  via: 'oauth' | 'keys'
  lastPayment: { amountPaise: number; at: string } | null
  lastUpdateAt: string | null
  problems: PaymentProblem[]
}

export type GatewayApp = {
  /** Plugin id, which is also the gateway's provider id. */
  id: string
  name: string
  installed: boolean
  connected: boolean
  methods: string[]
}

const webhookUrlFor = (workerUrl: string, providerId: string, storeId: string) =>
  `${workerUrl.replace(/\/$/, '')}/webhooks/payments/${providerId}/${storeId}`

function modeOf(id: string, cfg: Record<string, string> | undefined): 'test' | 'live' | null {
  if (!cfg) return null
  if (id === 'cashfree') return cfg.mode === 'live' ? 'live' : 'test'
  const key = cfg.keyId ?? ''
  if (key.startsWith('rzp_test_')) return 'test'
  if (key.startsWith('rzp_live_')) return 'live'
  return null
}

async function loadSettings(tx: StoreTx, storeId: string): Promise<PaymentSettings> {
  const [s] = await tx.select({ payments: store.payments }).from(store).where(eq(store.id, storeId))
  return parsePaymentSettings(s?.payments)
}

/** Payment gateways this deployment ships (Connection apps in the payments category). */
function gatewayApps(installed: Set<string>, enabled: string[]): GatewayApp[] {
  return getRegistries()
    .summaries()
    .filter((p) => p.kind === 'connection' && p.category === 'payments')
    .map((p) => {
      const main = p.provides.payments.find((f) => isGatewayProvider(f.id))
      const isInstalled = installed.has(p.id)
      return {
        id: p.id,
        name: p.name,
        installed: isInstalled,
        connected: isInstalled && !!main && enabled.includes(main.id),
        methods: [...(getRegistries().payments.get(main?.id ?? '')?.methods ?? [])],
      }
    })
}

async function gatewayStatus(
  tx: StoreTx,
  registry: PaymentRegistry,
  settings: PaymentSettings,
  decrypted: PaymentSettings,
  id: string,
  methods: CheckoutMethod[],
  now: Date,
): Promise<GatewayStatus> {
  const cfg = decrypted.providers[id]
  const via = cfg?.accessToken ? 'oauth' : 'keys'
  const problems: PaymentProblem[] = []
  const built = registry.create(id, registry.configFor(id, decrypted.providers))
  if (!built.ok) problems.push({ code: 'config_invalid', detail: built.errors.join(', ') })
  const expires = cfg?.accessExpiresAt ? Date.parse(cfg.accessExpiresAt) : Number.NaN
  if (via === 'oauth' && Number.isFinite(expires) && expires < now.getTime()) {
    problems.push({ code: 'reconnect' })
  }
  if (settings.methods?.length && onlineMethodsOn(methods).length === 0) {
    problems.push({ code: 'no_online_methods' })
  }

  // Methods that run on this gateway's account and share its webhook (Razorpay UPI QR).
  const family = registry.ids().filter((x) => x === id || registry.get(x)?.credentialsFrom === id)
  const [last] = await tx
    .select({ amountPaise: payment.amountPaise, at: payment.createdAt })
    .from(payment)
    .where(
      and(inArray(payment.provider, family), inArray(payment.status, ['captured', 'refunded'])),
    )
    .orderBy(desc(payment.createdAt))
    .limit(1)
  const [update] = await tx
    .select({ at: paymentEvent.receivedAt })
    .from(paymentEvent)
    .where(eq(paymentEvent.provider, id))
    .orderBy(desc(paymentEvent.receivedAt))
    .limit(1)

  // A captured payment the gateway never told us about (it was confirmed from
  // the browser or by asking the gateway) means its updates aren't arriving.
  if (last) {
    const age = now.getTime() - last.at.getTime()
    const silent = !update || update.at.getTime() < last.at.getTime()
    if (silent && age > WEBHOOK_GRACE_MS && age < WEBHOOK_LOOKBACK_MS) {
      problems.push({ code: 'webhook_silent', fix: via === 'oauth' ? 'reregister' : 'dashboard' })
    }
  }

  return {
    id,
    label: registry.get(id)?.label ?? id,
    mode: modeOf(id, cfg),
    via,
    lastPayment: last ? { amountPaise: last.amountPaise, at: last.at.toISOString() } : null,
    lastUpdateAt: update ? update.at.toISOString() : null,
    problems,
  }
}

/**
 * Everything Settings → Payments shows: saved settings (secrets masked), the
 * method row, the main gateway's health, the gateway apps on offer, and
 * whether the store can take payments at all.
 */
export async function paymentsSetup(
  tx: StoreTx,
  storeId: string,
  registry: PaymentRegistry,
  installedApps: string[],
  env: PaymentsEnv,
  now: Date = new Date(),
) {
  const settings = await loadSettings(tx, storeId)
  const decrypted = decryptPaymentSettings(settings, env.secret, env.previousSecrets)
  const methods = checkoutMethodsOf(settings)
  const primaryId =
    settings.enabled.find(isGatewayProvider) ??
    GATEWAY_PROVIDER_IDS.find(
      (id) => registry.get(id) && Object.values(decrypted.providers[id] ?? {}).some(Boolean),
    ) ??
    null
  const primary = primaryId
    ? await gatewayStatus(tx, registry, settings, decrypted, primaryId, methods, now)
    : null
  const gatewayOn = !!primaryId && settings.enabled.includes(primaryId)
  const online = gatewayOn && onlineMethodsOn(methods).length > 0
  const offline = settings.enabled.some((id) => id === 'cod' || id === 'manual')
  return {
    settings: presentProviderSettings(settings, env.secret, registry, env.previousSecrets),
    available: availableProviders(registry),
    methods,
    primary,
    gateways: gatewayApps(new Set(installedApps), settings.enabled),
    canTakePayments: online || offline,
    canTakeOnline: online,
    showSetup: !gatewayOn && !settings.setupSkippedAt,
    razorpayOAuth: env.razorpayOAuth,
    webhookUrls: Object.fromEntries(
      GATEWAY_PROVIDER_IDS.map((id) => [id, webhookUrlFor(env.workerUrl, id, storeId)]),
    ) as Record<string, string>,
  }
}

/** True once the store has saved payment settings; before that every value is a default. */
async function paymentsEverSaved(tx: StoreTx, storeId: string): Promise<boolean> {
  const [s] = await tx.select({ payments: store.payments }).from(store).where(eq(store.id, storeId))
  const raw = s?.payments
  return !!raw && typeof raw === 'object' && Array.isArray((raw as { enabled?: unknown }).enabled)
}

/** Read, change and save the settings blob the way the admin form does: validated and encrypted. */
async function writeSettings(
  tx: StoreTx,
  storeId: string,
  registry: PaymentRegistry,
  env: Pick<PaymentsEnv, 'secret' | 'previousSecrets'>,
  change: (masked: PaymentSettings) => PaymentSettings,
) {
  const current = await loadSettings(tx, storeId)
  const masked = presentProviderSettings(current, env.secret, registry, env.previousSecrets)
  const next = prepareProviderSettings(
    change(masked),
    current,
    registry,
    env.secret,
    'payment provider',
  )
  await updateStorePayments(tx, storeId, next)
  return next
}

/** Turn methods on or off and reorder them; checkout follows the new order. */
export function savePaymentMethods(
  tx: StoreTx,
  storeId: string,
  registry: PaymentRegistry,
  env: Pick<PaymentsEnv, 'secret' | 'previousSecrets'>,
  methods: CheckoutMethod[],
) {
  return writeSettings(tx, storeId, registry, env, (s) => {
    const gateway =
      s.enabled.find(isGatewayProvider) ??
      GATEWAY_PROVIDER_IDS.find((id) => registry.get(id) && s.providers[id]?.keyId) ??
      GATEWAY_PROVIDER_IDS.find((id) => registry.get(id) && s.providers[id]?.appId) ??
      null
    const full = checkoutMethodsOf({ ...s, methods })
    return { ...s, methods: full, enabled: enabledForMethods(s.enabled, full, gateway) }
  })
}

/**
 * Save a gateway's credentials and make it the main way to get paid: it
 * replaces any other gateway at checkout (whose keys are kept, for switching
 * back). First connection also saves the default method row.
 */
export async function connectPaymentGateway(
  tx: StoreTx,
  storeId: string,
  registry: PaymentRegistry,
  env: Pick<PaymentsEnv, 'secret' | 'previousSecrets' | 'workerUrl'>,
  providerId: string,
  fields: Record<string, string>,
) {
  // COD starts off for a shop that never saved payment settings (its "on" is only
  // the schema default); a shop that saved its own choice keeps it.
  const everSaved = await paymentsEverSaved(tx, storeId)
  return writeSettings(tx, storeId, registry, env, (s) => {
    const others = s.enabled.filter((id) => !isGatewayProvider(id) || id === providerId)
    const methods = checkoutMethodsOf(
      s.methods?.length
        ? s
        : {
            ...s,
            methods: DEFAULT_CHECKOUT_METHODS.map((m) =>
              m.id === 'cod' ? { ...m, on: everSaved && s.enabled.includes('cod') } : m,
            ),
          },
    )
    const saved = { ...(s.providers[providerId] ?? {}), ...fields }
    // Cashfree takes its update URL per order, so nothing is set up by hand.
    if (providerId === 'cashfree')
      saved.notifyUrl = webhookUrlFor(env.workerUrl, providerId, storeId)
    return {
      ...s,
      methods,
      providers: { ...s.providers, [providerId]: saved },
      enabled: enabledForMethods(others, methods, providerId),
    }
  })
}

/** "Skip for now" on the first-time setup: the full page shows instead, and the guide can be reopened. */
export function skipPaymentSetup(
  tx: StoreTx,
  storeId: string,
  registry: PaymentRegistry,
  env: Pick<PaymentsEnv, 'secret' | 'previousSecrets'>,
  now: Date = new Date(),
) {
  return writeSettings(tx, storeId, registry, env, (s) => ({
    ...s,
    setupSkippedAt: now.toISOString(),
  }))
}

/**
 * The Connect page's "Test connection": the form's current values (a masked
 * secret means "the saved one") through the gateway's own read-only check.
 * Nothing is saved and nothing is created on the gateway.
 */
export async function testPaymentConnection(
  tx: StoreTx,
  storeId: string,
  registry: PaymentRegistry,
  env: Pick<PaymentsEnv, 'secret' | 'previousSecrets'>,
  providerId: string,
  fields: Record<string, string>,
): Promise<ConnectionTestResult> {
  const factory = registry.get(providerId)
  if (!factory) return { ok: false, message: 'Install this app from Apps first.' }
  const stored =
    decryptPaymentSettings(await loadSettings(tx, storeId), env.secret, env.previousSecrets)
      .providers[providerId] ?? {}
  const merged: Record<string, string> = { ...stored }
  for (const [k, v] of Object.entries(fields)) merged[k] = isMaskedSecret(v) ? (stored[k] ?? '') : v
  // The webhook secret isn't needed to prove the keys work.
  merged.webhookSecret ||= 'not-needed-for-a-test'
  const built = registry.create(providerId, merged)
  if (!built.ok) return { ok: false, message: `Fill in: ${built.errors.join(', ')}` }
  if (!built.provider.testConnection) {
    return { ok: false, message: `${factory.label} can't be tested from here yet.` }
  }
  return built.provider.testConnection()
}

/** Where Razorpay sends the merchant back after "Connect Razorpay"; registered on the partner app. */
export const razorpayRedirectUri = (adminUrl: string) =>
  `${adminUrl.replace(/\/$/, '')}/api/apps/razorpay/oauth/callback`

/** An OAuth `state` lives this long: enough to log in to Razorpay, too short to be replayed later. */
const OAUTH_STATE_TTL_MS = 30 * 60_000

type OAuthState = { storeId: string; mode: 'test' | 'live' }

const stateMac = (payload: string, secret: string) =>
  createHmac('sha256', `razorpay-oauth:${secret}`).update(payload).digest('base64url')

/**
 * The OAuth `state`: which store and mode started the connection, signed so a
 * forged or swapped callback (CSRF) is refused, and dated so it expires.
 */
export function signOAuthState(state: OAuthState, secret: string, now: Date = new Date()): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...state,
      exp: now.getTime() + OAUTH_STATE_TTL_MS,
      n: randomBytes(8).toString('hex'),
    }),
  ).toString('base64url')
  return `${payload}.${stateMac(payload, secret)}`
}

/** The store and mode inside a `state` we signed, or null when it is forged or expired. */
export function verifyOAuthState(
  raw: string,
  secret: string,
  now: Date = new Date(),
): OAuthState | null {
  const [payload, mac] = raw.split('.')
  if (!payload || !mac) return null
  const expected = Buffer.from(stateMac(payload, secret))
  const given = Buffer.from(mac)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      storeId?: unknown
      mode?: unknown
      exp?: unknown
    }
    if (typeof s.storeId !== 'string' || typeof s.exp !== 'number' || s.exp < now.getTime()) {
      return null
    }
    return { storeId: s.storeId, mode: s.mode === 'live' ? 'live' : 'test' }
  } catch {
    return null
  }
}

/** A random secret for a new webhook; the merchant copies it into the gateway's dashboard. */
const newWebhookSecret = (): string => randomBytes(18).toString('base64url')

/**
 * Finish "Connect Razorpay": swap the code for tokens, point the account's
 * payment updates at our webhook with a fresh secret, and save it all as the
 * main gateway. A webhook Razorpay refuses (a localhost worker, say) doesn't
 * block the connection; the health line offers "Fix" once the URL is public.
 */
export async function completeRazorpayOAuth(
  tx: StoreTx,
  storeId: string,
  registry: PaymentRegistry,
  env: Pick<PaymentsEnv, 'secret' | 'previousSecrets' | 'workerUrl'>,
  app: RazorpayOAuthApp,
  input: { code: string; mode: 'test' | 'live'; redirectUri: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ webhook: 'registered' | 'failed'; webhookError?: string | undefined }> {
  const tokens = await exchangeRazorpayCode(app, input, fetchImpl)
  const webhookSecret = newWebhookSecret()
  let webhookId = ''
  let webhookError: string | undefined
  try {
    webhookId = await registerRazorpayWebhook(
      {
        accessToken: tokens.accessToken,
        accountId: tokens.accountId,
        url: webhookUrlFor(env.workerUrl, 'razorpay', storeId),
        secret: webhookSecret,
      },
      fetchImpl,
    )
  } catch (err) {
    webhookError = err instanceof Error ? err.message : String(err)
  }
  await connectPaymentGateway(tx, storeId, registry, env, 'razorpay', {
    ...oauthConfigFields(tokens),
    keySecret: '',
    webhookSecret,
    webhookId,
    oauthMode: input.mode,
  })
  return webhookError ? { webhook: 'failed', webhookError } : { webhook: 'registered' }
}

/**
 * "Payment updates aren't arriving: Fix" for a Connect Razorpay account:
 * re-point the saved webhook at our URL, or create a new one (with a new
 * secret) when Razorpay no longer has it. Pasted-key connections can't be
 * fixed through the API; the admin shows the dashboard steps instead.
 */
export async function fixRazorpayWebhook(
  tx: StoreTx,
  storeId: string,
  registry: PaymentRegistry,
  env: Pick<PaymentsEnv, 'secret' | 'previousSecrets' | 'workerUrl'>,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectionTestResult> {
  const saved =
    decryptPaymentSettings(await loadSettings(tx, storeId), env.secret, env.previousSecrets)
      .providers.razorpay ?? {}
  if (!saved.accessToken || !saved.accountId) {
    return { ok: false, message: 'Only a "Connect Razorpay" account can be fixed from here.' }
  }
  const url = webhookUrlFor(env.workerUrl, 'razorpay', storeId)
  try {
    if (saved.webhookId) {
      const updated = await updateRazorpayWebhook(
        {
          accessToken: saved.accessToken,
          accountId: saved.accountId,
          webhookId: saved.webhookId,
          url,
        },
        fetchImpl,
      )
      if (updated) return { ok: true, message: 'Payment updates are switched back on.' }
    }
    const webhookSecret = newWebhookSecret()
    const webhookId = await registerRazorpayWebhook(
      { accessToken: saved.accessToken, accountId: saved.accountId, url, secret: webhookSecret },
      fetchImpl,
    )
    await writeSettings(tx, storeId, registry, env, (s) => ({
      ...s,
      providers: {
        ...s.providers,
        razorpay: { ...(s.providers.razorpay ?? {}), webhookSecret, webhookId },
      },
    }))
    return { ok: true, message: 'Payment updates are switched back on.' }
  } catch (err) {
    return {
      ok: false,
      message: `Razorpay said no: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/** A signed link that opens the storefront checkout with just the ₹1 test product in the basket. */
export async function paymentTestOrderLink(
  tx: StoreTx,
  storeId: string,
  env: Pick<PaymentsEnv, 'secret' | 'storefrontUrl'>,
): Promise<string> {
  const cartId = await createPaymentTestCart({ storeId, tx })
  return recoveryUrl(cartId, env.secret, env.storefrontUrl)
}
