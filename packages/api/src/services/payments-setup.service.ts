import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  activateGateway,
  type CheckoutMethod,
  checkoutMethodsOf,
  checkoutTestMode,
  createPaymentTestCart,
  DEFAULT_CHECKOUT_METHODS,
  deactivateGateway,
  decryptPaymentSettings,
  enabledForMethods,
  GATEWAY_PROVIDER_IDS,
  gatewayKeySets,
  isGatewayInactive,
  isGatewayProvider,
  isMaskedSecret,
  keySetMode,
  onlineMethodsOn,
  type PaymentMode,
  type PaymentRegistry,
  type PaymentSettings,
  parsePaymentSettings,
  recoveryUrl,
  storefrontOriginFor,
  switchKeySet,
  withKeySet,
} from '@commerce/core'
import { getRegistries } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import { payment, paymentEvent, store } from '@commerce/db'
import type { ConnectionTestResult } from '@commerce/payments'
import {
  exchangeRazorpayCode,
  oauthConfigFields,
  RAZORPAY_WEBHOOK_EVENTS,
  type RazorpayOAuthApp,
  registerRazorpayWebhook,
  updateRazorpayWebhook,
} from '@commerce/payments-razorpay'
import { ORPCError } from '@orpc/server'
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
  /** STOREFRONT_URL: the fallback when the store has no live primary domain. */
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
  /** Saved keys exist, in either mode. */
  configured: boolean
  /** The Active/Inactive switch is off: out of checkout, keys kept. */
  inactive: boolean
  /** The key set checkout uses; null before any keys are saved. */
  mode: PaymentMode | null
  /** Which of the two key sets are saved. */
  keys: Record<PaymentMode, boolean>
}

const webhookUrlFor = (workerUrl: string, providerId: string, storeId: string) =>
  `${workerUrl.replace(/\/$/, '')}/webhooks/payments/${providerId}/${storeId}`

async function loadSettings(tx: StoreTx, storeId: string): Promise<PaymentSettings> {
  const [s] = await tx.select({ payments: store.payments }).from(store).where(eq(store.id, storeId))
  return parsePaymentSettings(s?.payments)
}

/** Payment gateways this deployment ships (Connection apps in the payments category). */
function gatewayApps(installed: Set<string>, settings: PaymentSettings): GatewayApp[] {
  const { enabled } = settings
  return getRegistries()
    .summaries()
    .filter((p) => p.kind === 'connection' && p.category === 'payments')
    .map((p) => {
      // A UPI-only app (Decentro) has no main gateway; its one method is the app.
      const main =
        p.provides.payments.find((f) => isGatewayProvider(f.id)) ?? p.provides.payments[0]
      const isInstalled = installed.has(p.id)
      const mainId = main?.id ?? p.id
      const sets = gatewayKeySets(settings.providers, mainId)
      return {
        id: p.id,
        name: p.name,
        installed: isInstalled,
        connected: isInstalled && !!main && enabled.includes(main.id),
        methods: [...(getRegistries().payments.get(main?.id ?? '')?.methods ?? [])],
        configured: !!sets.test || !!sets.live,
        inactive: isGatewayInactive(settings, mainId),
        mode: sets.active,
        keys: { test: !!sets.test, live: !!sets.live },
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
    mode: gatewayKeySets(decrypted.providers, id).active,
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
  const gateways = gatewayApps(new Set(installedApps), settings)
  return {
    settings: presentProviderSettings(settings, env.secret, registry, env.previousSecrets),
    available: availableProviders(registry),
    methods,
    primary,
    gateways,
    /** A gateway on at checkout runs on test keys: its payments are not real. */
    testMode: gateways.some((g) => g.connected && g.mode === 'test'),
    canTakePayments: online || offline,
    canTakeOnline: online,
    showSetup: !gatewayOn && !settings.setupSkippedAt,
    razorpayOAuth: env.razorpayOAuth,
    webhookUrls: Object.fromEntries(
      GATEWAY_PROVIDER_IDS.map((id) => [id, webhookUrlFor(env.workerUrl, id, storeId)]),
    ) as Record<string, string>,
    /** The events to tick on a webhook added by hand in Razorpay's dashboard. */
    razorpayWebhookEvents: [...RAZORPAY_WEBHOOK_EVENTS],
  }
}

/** A gateway at checkout runs on its test keys: what the admin-wide "Test mode" banner shows. */
export async function paymentsTestMode(tx: StoreTx, storeId: string): Promise<boolean> {
  return checkoutTestMode(await loadSettings(tx, storeId))
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
    // A gateway the merchant switched off stays off when methods are saved.
    const usable = (id: string) => !!registry.get(id) && !isGatewayInactive(s, id)
    const gateway =
      s.enabled.find(isGatewayProvider) ??
      GATEWAY_PROVIDER_IDS.find((id) => usable(id) && s.providers[id]?.keyId) ??
      GATEWAY_PROVIDER_IDS.find((id) => usable(id) && s.providers[id]?.appId) ??
      null
    const full = checkoutMethodsOf({ ...s, methods })
    return { ...s, methods: full, enabled: enabledForMethods(s.enabled, full, gateway) }
  })
}

/**
 * Save one of a gateway's two key sets (test or live). When it is the set
 * checkout uses, or the gateway has none yet, the gateway becomes the main way
 * to get paid: it replaces any other gateway at checkout (whose keys are kept,
 * for switching back), and first connection also saves the default method row.
 * A set for the other mode is only stored; the Live/Test switch puts it to use.
 */
export async function connectPaymentGateway(
  tx: StoreTx,
  storeId: string,
  registry: PaymentRegistry,
  env: Pick<PaymentsEnv, 'secret' | 'previousSecrets' | 'workerUrl'>,
  providerId: string,
  fields: Record<string, string>,
  mode?: PaymentMode,
) {
  // COD starts off for a shop that never saved payment settings (its "on" is only
  // the schema default); a shop that saved its own choice keeps it.
  const everSaved = await paymentsEverSaved(tx, storeId)
  return writeSettings(tx, storeId, registry, env, (s) => {
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
    const slot = mode ?? keySetMode(fields) ?? 'live'
    const saved = { ...(gatewayKeySets(s.providers, providerId)[slot] ?? {}), ...fields }
    // Cashfree and Decentro pick their sandbox or live host from `mode`.
    if (providerId === 'cashfree' || providerId === 'decentro') saved.mode = slot
    const detected = keySetMode(saved)
    if (detected && detected !== slot) {
      // A `rzp_test_` key pasted under Live, or the other way round.
      throw new ORPCError('BAD_REQUEST', {
        message:
          slot === 'live'
            ? 'These are test keys. Paste your live keys here.'
            : 'These are live keys. Paste your test keys here.',
      })
    }
    // Cashfree takes its update URL per order, so nothing is set up by hand.
    if (providerId === 'cashfree')
      saved.notifyUrl = webhookUrlFor(env.workerUrl, providerId, storeId)
    const { providers, inUse } = withKeySet(s.providers, providerId, slot, saved)
    if (!inUse) return { ...s, providers }
    return activateGateway({ ...s, methods, providers }, providerId, methods)
  })
}

/**
 * The Live ⇄ Test switch on a gateway's card. The waiting key set becomes the
 * one checkout uses and the other waits; nothing is deleted. Going live first
 * proves the live keys work with the gateway's own read-only check.
 */
export async function switchPaymentMode(
  tx: StoreTx,
  storeId: string,
  registry: PaymentRegistry,
  env: Pick<PaymentsEnv, 'secret' | 'previousSecrets'>,
  providerId: string,
  to: PaymentMode,
): Promise<ConnectionTestResult & { code?: 'no_keys' | 'check_failed' }> {
  const current = await loadSettings(tx, storeId)
  const decrypted = decryptPaymentSettings(current, env.secret, env.previousSecrets)
  const incoming = gatewayKeySets(decrypted.providers, providerId)[to]
  if (!incoming) {
    return { ok: false, code: 'no_keys', message: `Add your ${to} keys first.` }
  }
  if (to === 'live') {
    const built = registry.create(providerId, {
      ...registry.configFor(providerId, decrypted.providers),
      ...incoming,
    })
    if (!built.ok) {
      return { ok: false, code: 'check_failed', message: `Fill in: ${built.errors.join(', ')}` }
    }
    const check = await built.provider.testConnection?.()
    if (check && !check.ok) return { ...check, code: 'check_failed' }
  }
  // Swapped on the stored (encrypted) blob: the masked form would let one set's
  // "unchanged" secrets be filled from the other set.
  const swapped = switchKeySet(current.providers, providerId, to)
  if (!swapped.ok) return { ok: false, code: 'no_keys', message: `Add your ${to} keys first.` }
  await updateStorePayments(tx, storeId, { ...current, providers: swapped.providers })
  return { ok: true, message: to === 'live' ? 'Live: payments are real.' : 'Test mode is on.' }
}

/**
 * The Active/Inactive switch: an inactive gateway leaves checkout at once and
 * keeps its keys and settings; switching it on restores what it had on.
 */
export async function setPaymentGatewayActive(
  tx: StoreTx,
  storeId: string,
  registry: PaymentRegistry,
  gatewayId: string,
  active: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const current = await loadSettings(tx, storeId)
  if (active) {
    const sets = gatewayKeySets(current.providers, gatewayId)
    if (!sets.active) return { ok: false, message: 'Connect it first.' }
    const methods = checkoutMethodsOf(current)
    await updateStorePayments(tx, storeId, activateGateway(current, gatewayId, methods))
    return { ok: true }
  }
  const family = registry
    .ids()
    .filter((x) => x === gatewayId || registry.get(x)?.credentialsFrom === gatewayId)
  await updateStorePayments(tx, storeId, deactivateGateway(current, gatewayId, family))
  return { ok: true }
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
  mode?: PaymentMode,
): Promise<ConnectionTestResult> {
  const factory = registry.get(providerId)
  if (!factory) return { ok: false, message: 'Install this app from Apps first.' }
  const sets = gatewayKeySets(
    decryptPaymentSettings(await loadSettings(tx, storeId), env.secret, env.previousSecrets)
      .providers,
    providerId,
  )
  // A masked secret means "the saved one" of the key set being edited.
  const stored = sets[mode ?? sets.active ?? 'live'] ?? {}
  const merged: Record<string, string> = { ...stored }
  for (const [k, v] of Object.entries(fields)) merged[k] = isMaskedSecret(v) ? (stored[k] ?? '') : v
  if (mode && (providerId === 'cashfree' || providerId === 'decentro')) merged.mode = mode
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
  await connectPaymentGateway(
    tx,
    storeId,
    registry,
    env,
    'razorpay',
    {
      ...oauthConfigFields(tokens),
      keySecret: '',
      webhookSecret,
      webhookId,
      oauthMode: input.mode,
    },
    input.mode,
  )
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
  // The checkout (and the gateway's return to it) must run on a host that serves this store.
  return recoveryUrl(cartId, env.secret, await storefrontOriginFor(tx, storeId, env.storefrontUrl))
}
