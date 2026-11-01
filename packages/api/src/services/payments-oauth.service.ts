/**
 * Razorpay OAuth for Settings → Payments: the signed state, the callback that stores the
 * merchant's keys and webhook, the webhook fix, and the test order link. Split out of
 * payments-setup.service.ts.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  createPaymentTestCart,
  decryptPaymentSettings,
  type PaymentRegistry,
  recoveryUrl,
  storefrontOriginFor,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import type { ConnectionTestResult } from '@commerce/payments'
import {
  exchangeRazorpayCode,
  oauthConfigFields,
  type RazorpayOAuthApp,
  registerRazorpayWebhook,
  updateRazorpayWebhook,
} from '@commerce/payments-razorpay'
import {
  connectPaymentGateway,
  loadSettings,
  type PaymentsEnv,
  webhookUrlFor,
  writeSettings,
} from './payments-setup.service'

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
