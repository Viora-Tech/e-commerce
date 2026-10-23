/** SOURCE OF TRUTH: WhatsApp Embedded Signup — WHAT: finish Meta's Embedded Signup v4 (code exchange, webhook subscription, number registration) / WHY: merchants connect WhatsApp in one popup instead of pasting ids and tokens */
/**
 * WhatsApp Embedded Signup v4, the Tech Provider way in
 * (developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup):
 *
 * 1. The admin opens Meta's popup with the JS SDK (`FB.login` with the Embedded Signup
 *    configuration, `response_type: 'code'`). The merchant picks or makes their business,
 *    WhatsApp Business account and number; the popup posts `WA_EMBEDDED_SIGNUP` with the
 *    `waba_id` and `phone_number_id`, and `FB.login` returns a `code` that lives 30 seconds.
 * 2. Here, straight away: the code becomes a business token (a business integration system
 *    user token, no expiry); our app subscribes to the account's webhooks
 *    (`/{waba}/subscribed_apps`); the number is registered for the Cloud API with a new
 *    two-step PIN (`/{phone}/register`); and we read the number's name and quality.
 *
 * The caller saves the result as the store's WhatsApp channel settings (encrypted, like a
 * pasted token) and links the account (`platform_account`, `whatsapp`) for its webhooks.
 * Every call takes `fetchImpl`, so tests never reach Meta.
 */
import { createHmac, randomInt } from 'node:crypto'
import { z } from 'zod'
import { CommerceError } from '../errors'
import { META_GRAPH_VERSION } from '../sales-channels/providers'

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`

export class WhatsappSignupError extends CommerceError {
  constructor(message: string) {
    super('WHATSAPP_SIGNUP', message)
  }
}

/** The Meta app and its Embedded Signup configuration; null hides "Connect with Facebook". */
export type WhatsappSignupApp = { appId: string; appSecret: string; configId: string }

export function whatsappSignupApp(
  env: Record<string, string | undefined>,
): WhatsappSignupApp | null {
  const appId = env.META_APP_ID?.trim()
  const appSecret = env.META_APP_SECRET?.trim()
  const configId = env.META_WHATSAPP_CONFIG_ID?.trim()
  return appId && appSecret && configId ? { appId, appSecret, configId } : null
}

/** What the browser hands over after the popup: the code and the ids from the session event. */
export const WhatsappSignupSchema = z.object({
  code: z.string().trim().min(10).max(1000),
  wabaId: z
    .string()
    .trim()
    .regex(/^\d{5,25}$/, 'Not a WhatsApp Business account id'),
  phoneNumberId: z
    .string()
    .trim()
    .regex(/^\d{5,25}$/, 'Not a phone number id'),
})
export type WhatsappSignupInput = z.infer<typeof WhatsappSignupSchema>

export type WhatsappSignupResult = {
  /** The business token: the channel's access token. */
  accessToken: string
  wabaId: string
  phoneNumberId: string
  /** The two-step PIN the number was registered with; kept encrypted for re-registering. */
  pin: string
  /** False when Meta refused to register the number (already registered elsewhere, say). */
  registered: boolean
  registerError: string | null
  displayPhone: string | null
  verifiedName: string | null
  quality: string | null
}

type GraphError = { error?: { message?: string } }

async function call<T>(fetchImpl: typeof fetch, url: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(30_000) })
  } catch {
    throw new WhatsappSignupError('Could not reach Meta. Try connecting again.')
  }
  const body = (await res.json().catch(() => ({}))) as T & GraphError
  if (!res.ok)
    throw new WhatsappSignupError(body.error?.message?.slice(0, 300) ?? 'Meta refused the request.')
  return body
}

const proof = (token: string, app: WhatsappSignupApp) =>
  createHmac('sha256', app.appSecret).update(token).digest('hex')

const postForm = (token: string, app: WhatsappSignupApp, form: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ access_token: token, appsecret_proof: proof(token, app), ...form }),
})

/** A six-digit two-step verification PIN. */
const newWhatsappPin = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

export async function completeWhatsappSignup(
  fetchImpl: typeof fetch,
  app: WhatsappSignupApp,
  raw: WhatsappSignupInput,
  pin: string = newWhatsappPin(),
): Promise<WhatsappSignupResult> {
  const input = WhatsappSignupSchema.parse(raw)
  // 1. The 30-second code → the business token (no redirect_uri: the code came from the SDK).
  const { access_token: token } = await call<{ access_token: string }>(
    fetchImpl,
    `${GRAPH}/oauth/access_token?${new URLSearchParams({
      client_id: app.appId,
      client_secret: app.appSecret,
      code: input.code,
    })}`,
  )
  if (!token) throw new WhatsappSignupError('Meta did not return access. Try connecting again.')

  // 2. Our app hears this account's webhooks (account updates, message statuses).
  await call(fetchImpl, `${GRAPH}/${input.wabaId}/subscribed_apps`, postForm(token, app))

  // 3. The number joins the Cloud API. A number already registered elsewhere refuses; the
  //    connection still works for templates, and the page says how to finish.
  let registered = true
  let registerError: string | null = null
  try {
    await call(
      fetchImpl,
      `${GRAPH}/${input.phoneNumberId}/register`,
      postForm(token, app, { messaging_product: 'whatsapp', pin }),
    )
  } catch (err) {
    registered = false
    registerError = err instanceof Error ? err.message : 'Meta did not register the number.'
  }

  // 4. What the merchant recognises the number by.
  const phone = await call<{
    display_phone_number?: string
    verified_name?: string
    quality_rating?: string
  }>(
    fetchImpl,
    `${GRAPH}/${input.phoneNumberId}?${new URLSearchParams({
      fields: 'display_phone_number,verified_name,quality_rating',
      access_token: token,
      appsecret_proof: proof(token, app),
    })}`,
  ).catch(() => ({}) as Record<string, undefined>)

  return {
    accessToken: token,
    wabaId: input.wabaId,
    phoneNumberId: input.phoneNumberId,
    pin,
    registered,
    registerError,
    displayPhone: phone.display_phone_number ?? null,
    verifiedName: phone.verified_name ?? null,
    quality: phone.quality_rating ?? null,
  }
}
