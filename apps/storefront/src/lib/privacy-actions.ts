'use server'

import 'server-only'

import { loadEnv } from '@commerce/config'
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  channelPhone,
  confirmAccountDeletion,
  createDataRequest,
  deliverCustomerCode,
  encodeConsent,
  loadCustomerPrivacySettings,
  otpLimiterId,
  recordCookieConsent,
  requestAccountDeletionCode,
  requestPhoneLoginCode,
  verifyPhoneLoginCode,
} from '@commerce/core'
import { isPhoneMethod, type LoginMethod } from '@commerce/core/customer-accounts'
import { store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { accountContent } from '@/data/account'
import { privacyContent } from '@/data/privacy'
import { ATTRIBUTION_COOKIE, MARKETING_CLICK_COOKIE, SESSION_COOKIE } from './attribution-cookie'
import {
  clearCustomerToken,
  currentCustomer,
  safeReturnTo,
  writeCustomerToken,
} from './customer-session'
import { devOtpEnabled, rememberDevOtp } from './dev-otp'
import { clientIp, rateLimited } from './rate-limit'
import { lifetimeFor } from './shopper-login'
import { codeChannelDeps, deliverableMethods, devChannels, storeSignIn } from './sign-in-methods'
import { inStore } from './store-context'
import { parseVisitorId, VISITOR_COOKIE } from './visitor-cookie'

/**
 * Privacy and phone sign-in server actions. As in `account-actions.ts`, the
 * store comes from the proxy's `x-store-id` and the customer from the session,
 * never from the browser.
 */
async function storeId(): Promise<string> {
  const id = (await headers()).get('x-store-id')
  if (!id) throw new Error('store not resolved')
  return id
}

const TEN_MINUTES = 10 * 60 * 1000
const PHONE_SEND_RULE = { limit: 5, windowMs: TEN_MINUTES }
const PHONE_VERIFY_RULE = { limit: 10, windowMs: TEN_MINUTES }
const IP_SEND_RULE = { limit: 20, windowMs: TEN_MINUTES }
const IP_VERIFY_RULE = { limit: 40, windowMs: TEN_MINUTES }
const CONSENT_IP_RULE = { limit: 60, windowMs: TEN_MINUTES }
const DELETE_RULE = { limit: 5, windowMs: TEN_MINUTES }

async function storeName(sid: string): Promise<string> {
  const [s] = await inStore(sid, (tx) =>
    tx.select({ name: store.name }).from(store).where(eq(store.id, sid)),
  )
  return s?.name ?? ''
}

/**
 * The shopper answered the cookie banner: keep the proof (with the banner
 * version the store shows now) and set the cookie the storefront reads.
 */
export async function recordConsentAction(choice: {
  analytics: boolean
  marketing: boolean
}): Promise<{ ok: boolean }> {
  const sid = await storeId()
  const limited = await rateLimited('cookie-consent:ip', clientIp(await headers()), CONSENT_IP_RULE)
  if (!limited.ok) return { ok: false }
  const jar = await cookies()
  const me = await currentCustomer(sid)
  const now = new Date()
  const version = await inStore(sid, async (tx) => {
    const ctx = { tx, storeId: sid }
    const { bannerVersion } = await loadCustomerPrivacySettings(ctx)
    await recordCookieConsent(ctx, {
      analytics: choice.analytics === true,
      marketing: choice.marketing === true,
      bannerVersion,
      visitorId: parseVisitorId(jar.get(VISITOR_COOKIE)?.value),
      customerId: me?.id ?? null,
      at: now,
    })
    return bannerVersion
  })
  const secure = (await headers()).get('x-forwarded-proto') === 'https'
  jar.set(CONSENT_COOKIE, encodeConsent(choice, version, now), {
    path: '/',
    maxAge: CONSENT_MAX_AGE,
    sameSite: 'lax',
    secure,
  })
  // Saying no to analytics (now or later) also removes what analytics had set.
  if (!choice.analytics) {
    for (const name of [
      VISITOR_COOKIE,
      ATTRIBUTION_COOKIE,
      SESSION_COOKIE,
      MARKETING_CLICK_COOKIE,
    ]) {
      jar.delete(name)
    }
  }
  return { ok: true }
}

export type PhoneCodeState = { ok: boolean; mobile?: string; error?: string }

/** Send a sign-in code by SMS or WhatsApp, if the store offers that method. */
export async function requestPhoneCodeAction(
  phone: string,
  method: LoginMethod,
): Promise<PhoneCodeState> {
  const sid = await storeId()
  const copy = accountContent.login.errors
  if (!isPhoneMethod(method)) return { ok: false, error: copy.invalidPhone }
  const { methods } = await storeSignIn(sid)
  if (!methods.includes(method)) return { ok: false, error: copy.noPhone }
  const [byPhone, byIp] = await Promise.all([
    rateLimited('phone-code-send:phone', otpLimiterId(sid, 'phone', phone), PHONE_SEND_RULE),
    rateLimited('phone-code-send:ip', clientIp(await headers()), IP_SEND_RULE),
  ])
  if (!byPhone.ok || !byIp.ok) return { ok: false, error: copy.rateLimited }
  const r = await inStore(sid, (tx) => requestPhoneLoginCode({ tx, storeId: sid }, phone, method))
  if (!r.ok) {
    return { ok: false, error: r.reason === 'too_soon' ? copy.tooSoon : copy.invalidPhone }
  }
  const name = await storeName(sid)
  const sent = await inStore(sid, async (tx) =>
    deliverCustomerCode(
      { tx, storeId: sid },
      {
        method,
        code: r.code,
        storeName: name,
        to: { phone: channelPhone(r.mobile) },
        template: 'login_code',
      },
      await codeChannelDeps(tx, sid),
    ),
  )
  if (devOtpEnabled() || devChannels()) {
    console.log(`[account] ${method} sign-in code for ${r.mobile}: ${r.code}`)
    rememberDevOtp(sid, r.mobile, r.code)
  } else if (sent === 0) {
    return { ok: false, error: copy.noPhone }
  }
  return { ok: true, mobile: r.mobile }
}

export async function verifyPhoneCodeAction(
  mobile: string,
  code: string,
  returnTo: string,
  remember = true,
): Promise<{ error: string } | undefined> {
  const sid = await storeId()
  const [byPhone, byIp] = await Promise.all([
    rateLimited('phone-code-verify:phone', otpLimiterId(sid, 'phone', mobile), PHONE_VERIFY_RULE),
    rateLimited('phone-code-verify:ip', clientIp(await headers()), IP_VERIFY_RULE),
  ])
  if (!byPhone.ok || !byIp.ok) return { error: accountContent.login.errors.rateLimited }
  const secret = loadEnv(process.env).SETTINGS_SECRET
  const life = await lifetimeFor(sid, remember)
  const r = await inStore(sid, (tx) =>
    verifyPhoneLoginCode({ tx, storeId: sid }, mobile, code, secret, new Date(), life.ttlMs),
  )
  if (!r.ok) return { error: accountContent.login.errors[r.reason] }
  await writeCustomerToken(r.token, r.expiresAt, life.persistent)
  revalidatePath('/', 'layout')
  redirect(safeReturnTo(returnTo))
}

/** "Get a copy of my data": a request in the store's queue; the store sends the file. */
export async function requestDataCopyAction(): Promise<{ ok: boolean; error?: string }> {
  const sid = await storeId()
  const me = await currentCustomer(sid)
  if (!me) redirect('/account/login?return_to=/account/privacy')
  await inStore(sid, (tx) =>
    createDataRequest(
      { tx, storeId: sid },
      {
        kind: 'export',
        source: 'account',
        customerId: me.id,
        contactEmail: me.email,
        contactPhone: me.phone,
        actor: { type: 'customer', id: me.id },
      },
    ),
  )
  revalidatePath('/account/privacy')
  return { ok: true }
}

export type DeletionCodeState = { ok: boolean; hint?: string; error?: string }

/** Step one of deleting an account: a code to the customer's email or mobile. */
export async function requestDeletionCodeAction(): Promise<DeletionCodeState> {
  const sid = await storeId()
  const copy = privacyContent.deletion.errors
  const me = await currentCustomer(sid)
  if (!me) redirect('/account/login?return_to=/account/privacy')
  const limited = await rateLimited('account-delete:customer', me.id, DELETE_RULE)
  if (!limited.ok) return { ok: false, error: copy.rateLimited }
  const secret = loadEnv(process.env).SETTINGS_SECRET
  const name = await storeName(sid)
  const result = await inStore(sid, async (tx) => {
    const ctx = { tx, storeId: sid }
    const methods = await deliverableMethods(tx, sid)
    const r = await requestAccountDeletionCode(ctx, me.id, methods, secret)
    if (!r.ok) return r
    const sent = await deliverCustomerCode(
      ctx,
      {
        method: r.method,
        code: r.code,
        storeName: name,
        to: r.to,
        template: 'account_deletion_code',
      },
      await codeChannelDeps(tx, sid),
    )
    return { ...r, sent }
  })
  if (!result.ok) {
    return { ok: false, error: result.reason === 'too_soon' ? copy.tooSoon : copy.noChannel }
  }
  if (devOtpEnabled() || devChannels()) {
    console.log(`[account] deletion code for customer ${me.id}: ${result.code}`)
    rememberDevOtp(sid, `delete:${me.id}`, result.code)
  } else if (result.sent === 0) {
    return { ok: false, error: copy.noChannel }
  }
  return { ok: true, hint: result.hint }
}

/** Step two: the code opens a deletion request and signs the customer out everywhere. */
export async function confirmDeletionAction(
  code: string,
  note: string,
): Promise<{ error: string } | undefined> {
  const sid = await storeId()
  const me = await currentCustomer(sid)
  if (!me) redirect('/account/login')
  const r = await inStore(sid, (tx) =>
    confirmAccountDeletion({ tx, storeId: sid }, me.id, code, {
      note: note.trim().slice(0, 2000) || undefined,
    }),
  )
  if (!r.ok) return { error: privacyContent.deletion.errors[r.reason] }
  await clearCustomerToken()
  revalidatePath('/', 'layout')
  redirect('/account/deleted')
}
