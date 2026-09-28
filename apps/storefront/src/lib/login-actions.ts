'use server'

import 'server-only'

import { randomBytes } from 'node:crypto'
import {
  deliverLoginLink,
  openToken,
  passkeyLoginOptions,
  passkeyRegistrationOptions,
  pollTruecaller,
  randomToken,
  redeemMagicLink,
  removeCustomerIdentity,
  removeCustomerPasskey,
  requestMagicLink,
  resolveShopperIdentity,
  safeNextPath,
  signToken,
  startTruecaller,
  truecallerDeepLink,
  verifyOneTapCredential,
  verifyPasskeyLogin,
  verifyPasskeyRegistration,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { accountContent } from '@/data/account'
import { currentCustomer } from './customer-session'
import { devOtpEnabled } from './dev-otp'
import { clientIp, rateLimited } from './rate-limit'
import {
  cookieSecure,
  ONE_TAP_COOKIE,
  PASSKEY_COOKIE,
  requestOrigin,
  settingsSecret,
  signInCustomer,
  storeLoginApp,
  storeLoginSetup,
  TRUECALLER_COOKIE,
  takeCookie,
} from './shopper-login'
import { inStore } from './store-context'

/*
 * Sign-in actions beyond the codes (`account-actions.ts`, `privacy-actions.ts`): magic
 * link, passkeys, Truecaller and Google One Tap, plus the account page's passkey and
 * connected-account list. The store is always the proxy's (`x-store-id`), the customer
 * always the session's.
 */

async function storeId(): Promise<string> {
  const id = (await headers()).get('x-store-id')
  if (!id) throw new Error('store not resolved')
  return id
}

const errors = accountContent.login.errors
const IP_RULE = { limit: 30, windowMs: 10 * 60 * 1000 }
const LINK_EMAIL_RULE = { limit: 5, windowMs: 10 * 60 * 1000 }

async function ipAllowed(scope: string): Promise<boolean> {
  return (await rateLimited(scope, clientIp(await headers()), IP_RULE)).ok
}

async function setShortCookie(name: string, value: string, maxAgeSeconds: number) {
  ;(await cookies()).set(name, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: await cookieSecure(),
    path: '/',
    maxAge: maxAgeSeconds,
  })
}

export type ActionResult = { ok: boolean; error?: string }

/** "Email me a sign-in link": a one-time link to the store's own domain. */
export async function requestMagicLinkAction(
  email: string,
  returnTo: string,
  remember: boolean,
): Promise<ActionResult> {
  const sid = await storeId()
  const { settings } = await storeLoginSetup(sid)
  if (!settings.magicLink) return { ok: false, error: errors.noEmail }
  const byEmail = await rateLimited('magic-link:email', email.toLowerCase(), LINK_EMAIL_RULE)
  if (!byEmail.ok || !(await ipAllowed('magic-link:ip'))) {
    return { ok: false, error: errors.rateLimited }
  }
  const r = await inStore(sid, (tx) =>
    requestMagicLink({ tx, storeId: sid }, email, { nextPath: safeNextPath(returnTo), remember }),
  )
  if (!r.ok)
    return { ok: false, error: r.reason === 'too_soon' ? errors.tooSoon : errors.invalidEmail }
  const { origin } = await requestOrigin()
  const url = `${origin}/account/login/link?token=${r.token}`
  const sent = await inStore(sid, async (tx) =>
    deliverLoginLink(
      { tx, storeId: sid },
      { email: r.email, url },
      {
        registry: (await registriesForStore(tx, sid)).notifications,
        settingsSecret: settingsSecret(),
      },
    ),
  )
  if (devOtpEnabled() || process.env.NODE_ENV !== 'production') {
    console.log(`[account] sign-in link for ${r.email}: ${url}`)
  } else if (sent === 0) {
    return { ok: false, error: errors.noEmail }
  }
  return { ok: true }
}

/** The magic link landing page's button. Spent on first use. */
export async function redeemMagicLinkAction(token: string): Promise<ActionResult> {
  const sid = await storeId()
  if (!(await ipAllowed('magic-link-redeem:ip'))) return { ok: false, error: errors.rateLimited }
  const r = await inStore(sid, (tx) => redeemMagicLink({ tx, storeId: sid }, token))
  if (!r.ok)
    return { ok: false, error: r.reason === 'expired' ? errors.linkExpired : errors.linkUsed }
  await signInCustomer(sid, r.customerId, r.remember)
  revalidatePath('/', 'layout')
  redirect(r.nextPath)
}

async function passkeyContext() {
  const { origin, hostname } = await requestOrigin()
  return { rpId: hostname, origin, secret: settingsSecret() }
}

/** Start a passkey sign-in: options for the browser, challenge sealed in a cookie. */
export async function passkeyLoginOptionsAction() {
  const sid = await storeId()
  const { settings } = await storeLoginSetup(sid)
  if (!settings.passkeys || !(await ipAllowed('passkey:ip'))) return null
  const { options, challenge } = await passkeyLoginOptions(sid, await passkeyContext())
  await setShortCookie(PASSKEY_COOKIE, challenge, 300)
  return options
}

export async function passkeySignInAction(
  response: unknown,
  returnTo: string,
  remember: boolean,
): Promise<ActionResult> {
  const sid = await storeId()
  const challenge = await takeCookie(PASSKEY_COOKIE)
  const r = await inStore(sid, async (tx) =>
    verifyPasskeyLogin({ tx, storeId: sid }, { ...(await passkeyContext()), response, challenge }),
  )
  if (!r.ok) return { ok: false, error: errors.passkeyFailed }
  await signInCustomer(sid, r.customerId, remember)
  revalidatePath('/', 'layout')
  redirect(safeNextPath(returnTo))
}

/** Account page: options to add a passkey for the signed-in shopper on this domain. */
export async function passkeyRegisterOptionsAction() {
  const sid = await storeId()
  const me = await currentCustomer(sid)
  if (!me) return null
  const { settings } = await storeLoginSetup(sid)
  if (!settings.passkeys) return null
  const storeName = (await headers()).get('host') ?? ''
  const r = await inStore(sid, async (tx) =>
    passkeyRegistrationOptions({ tx, storeId: sid }, me.id, {
      ...(await passkeyContext()),
      storeName,
    }),
  )
  if (!r) return null
  await setShortCookie(PASSKEY_COOKIE, r.challenge, 300)
  return r.options
}

export async function passkeyRegisterAction(
  response: unknown,
  name: string,
): Promise<ActionResult> {
  const sid = await storeId()
  const me = await currentCustomer(sid)
  if (!me) return { ok: false, error: errors.passkeyFailed }
  const challenge = await takeCookie(PASSKEY_COOKIE)
  const r = await inStore(sid, async (tx) =>
    verifyPasskeyRegistration({ tx, storeId: sid }, me.id, {
      ...(await passkeyContext()),
      response,
      challenge,
      name,
    }),
  )
  if (!r.ok) return { ok: false, error: errors.passkeyFailed }
  revalidatePath('/account/profile')
  return { ok: true }
}

export async function removePasskeyAction(id: string): Promise<ActionResult> {
  const sid = await storeId()
  const me = await currentCustomer(sid)
  if (!me) return { ok: false }
  const ok = await inStore(sid, (tx) => removeCustomerPasskey({ tx, storeId: sid }, me.id, id))
  revalidatePath('/account/profile')
  return { ok }
}

export async function removeIdentityAction(id: string): Promise<ActionResult> {
  const sid = await storeId()
  const me = await currentCustomer(sid)
  if (!me) return { ok: false }
  const ok = await inStore(sid, (tx) => removeCustomerIdentity({ tx, storeId: sid }, me.id, id))
  revalidatePath('/account/profile')
  return { ok }
}

/** Tap "Continue with Truecaller": a pending request and the deep link that opens the app. */
export async function startTruecallerAction(
  returnTo: string,
  remember: boolean,
): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  const sid = await storeId()
  const app = await storeLoginApp(sid, 'truecaller')
  if (!app) return { ok: false, error: errors.unavailable }
  if (!(await ipAllowed('truecaller:ip'))) return { ok: false, error: errors.rateLimited }
  const secret = settingsSecret()
  const nonce = await inStore(sid, (tx) =>
    startTruecaller(
      { tx, storeId: sid },
      { secret, random: randomBytes(12), nextPath: safeNextPath(returnTo), remember },
    ),
  )
  await setShortCookie(TRUECALLER_COOKIE, nonce, 600)
  const { origin } = await requestOrigin()
  return {
    ok: true,
    link: truecallerDeepLink({
      nonce,
      partnerKey: app.partnerKey,
      partnerName: app.partnerName,
      privacyUrl: `${origin}/policies/privacy-policy`,
      termsUrl: `${origin}/policies/terms-of-service`,
    }),
  }
}

/** The page asks every few seconds; a ready answer signs this browser in. */
export async function pollTruecallerAction(): Promise<
  { state: 'pending' } | { state: 'failed' } | { state: 'ready'; next: string }
> {
  const sid = await storeId()
  const nonce = (await cookies()).get(TRUECALLER_COOKIE)?.value ?? null
  const r = await inStore(sid, (tx) => pollTruecaller({ tx, storeId: sid }, nonce))
  if (r.state !== 'ready') {
    if (r.state === 'failed') await takeCookie(TRUECALLER_COOKIE)
    return r
  }
  await takeCookie(TRUECALLER_COOKIE)
  await signInCustomer(sid, r.customerId, r.remember)
  revalidatePath('/', 'layout')
  return { state: 'ready', next: r.nextPath }
}

/** A fresh nonce for Google One Tap, kept in a cookie to check the credential against. */
export async function oneTapNonceAction(): Promise<string | null> {
  const sid = await storeId()
  if (!(await storeLoginApp(sid, 'google'))) return null
  const nonce = randomToken(24)
  await setShortCookie(
    ONE_TAP_COOKIE,
    signToken({ n: nonce, e: Date.now() + 600_000 }, settingsSecret(), 'one-tap'),
    600,
  )
  return nonce
}

/** Google One Tap's credential: checked on this domain, then linked like any Google sign-in. */
export async function oneTapSignInAction(
  credential: string,
  returnTo: string,
  remember: boolean,
): Promise<ActionResult> {
  const sid = await storeId()
  const sealed = openToken<{ n: string; e: number }>(
    await takeCookie(ONE_TAP_COOKIE),
    settingsSecret(),
    'one-tap',
  )
  const app = await storeLoginApp(sid, 'google')
  const { settings } = await storeLoginSetup(sid)
  if (!sealed.ok || !app || !settings.googleOneTap) return { ok: false, error: errors.failed }
  if (!(await ipAllowed('one-tap:ip'))) return { ok: false, error: errors.rateLimited }
  const identity = await verifyOneTapCredential(app, credential, sealed.payload.n).catch(() => null)
  if (!identity) return { ok: false, error: errors.failed }
  const r = await inStore(sid, (tx) =>
    resolveShopperIdentity({ tx, storeId: sid }, identity, { secret: settingsSecret() }),
  )
  if (r.kind !== 'signed_in') return { ok: false, error: errors.failed }
  await signInCustomer(sid, r.customerId, remember)
  revalidatePath('/', 'layout')
  redirect(safeNextPath(returnTo))
}
