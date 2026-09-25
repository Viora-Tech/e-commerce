'use server'

import 'server-only'

import { loadEnv } from '@commerce/config'
import {
  addToCart,
  createAddress,
  createCart,
  deleteAddress,
  deliverLoginCode,
  getCart,
  reorderLines,
  requestLoginCode,
  revokeCustomerSession,
  setDefaultAddress,
  updateAddress,
  updateProfile,
  verifyLoginCode,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { accountContent } from '@/data/account'
import { readCartId, writeCartId } from './cart-cookie'
import {
  clearCustomerToken,
  currentCustomer,
  readCustomerToken,
  safeReturnTo,
  writeCustomerToken,
} from './customer-session'
import { devOtpEnabled, rememberDevOtp } from './dev-otp'
import { clientIp, rateLimited } from './rate-limit'
import { inStore } from './store-context'

/**
 * Account server actions. The store is the one the proxy resolved from the
 * hostname (`x-store-id`), never an argument the browser could change, and the
 * customer is always the session's, never an id from the form.
 */
async function storeId(): Promise<string> {
  const id = (await headers()).get('x-store-id')
  if (!id) throw new Error('store not resolved')
  return id
}

async function me(sid: string) {
  const c = await currentCustomer(sid)
  if (!c) redirect('/account/login')
  return c
}

export type CodeRequestState = { ok: boolean; email?: string; error?: string }

/** Existing per-email resend lockout (`requestLoginCode`'s `too_soon`) stays; this is a coarser backstop against bursts. */
const OTP_SEND_EMAIL_RULE = { limit: 5, windowMs: 10 * 60 * 1000 }
const OTP_SEND_IP_RULE = { limit: 20, windowMs: 10 * 60 * 1000 }
const OTP_VERIFY_EMAIL_RULE = { limit: 10, windowMs: 10 * 60 * 1000 }
const OTP_VERIFY_IP_RULE = { limit: 40, windowMs: 10 * 60 * 1000 }

export async function requestCodeAction(email: string): Promise<CodeRequestState> {
  const sid = await storeId()
  const copy = accountContent.login.errors
  const ip = clientIp(await headers())
  const [byEmail, byIp] = await Promise.all([
    rateLimited('login-code-send:email', email.toLowerCase(), OTP_SEND_EMAIL_RULE),
    rateLimited('login-code-send:ip', ip, OTP_SEND_IP_RULE),
  ])
  if (!byEmail.ok || !byIp.ok) return { ok: false, error: copy.rateLimited }
  const result = await inStore(sid, (tx) => requestLoginCode({ storeId: sid, tx }, email))
  if (!result.ok) {
    return { ok: false, error: result.reason === 'too_soon' ? copy.tooSoon : copy.invalidEmail }
  }
  const env = loadEnv(process.env)
  const sent = await inStore(sid, async (tx) =>
    deliverLoginCode(
      { storeId: sid, tx },
      { email: result.email, code: result.code },
      {
        registry: (await registriesForStore(tx, sid)).notifications,
        settingsSecret: env.SETTINGS_SECRET,
      },
    ),
  )
  if (devOtpEnabled() || process.env.NODE_ENV !== 'production') {
    console.log(`[account] sign-in code for ${result.email}: ${result.code}`)
    rememberDevOtp(sid, result.email, result.code)
  } else if (sent === 0) {
    return { ok: false, error: copy.noEmail }
  }
  return { ok: true, email: result.email }
}

export async function verifyCodeAction(
  email: string,
  code: string,
  returnTo: string,
): Promise<{ error: string } | undefined> {
  const sid = await storeId()
  const ip = clientIp(await headers())
  const [byEmail, byIp] = await Promise.all([
    rateLimited('login-code-verify:email', email.toLowerCase(), OTP_VERIFY_EMAIL_RULE),
    rateLimited('login-code-verify:ip', ip, OTP_VERIFY_IP_RULE),
  ])
  if (!byEmail.ok || !byIp.ok) return { error: accountContent.login.errors.rateLimited }
  const result = await inStore(sid, (tx) => verifyLoginCode({ storeId: sid, tx }, email, code))
  if (!result.ok) return { error: accountContent.login.errors[result.reason] }
  await writeCustomerToken(result.token, result.expiresAt)
  revalidatePath('/', 'layout')
  redirect(safeReturnTo(returnTo))
}

export async function signOutAction(): Promise<void> {
  const sid = await storeId()
  const token = await readCustomerToken()
  if (token) await inStore(sid, (tx) => revokeCustomerSession({ storeId: sid, tx }, token))
  await clearCustomerToken()
  revalidatePath('/', 'layout')
  redirect('/')
}

export type FormResult = { ok: true } | { ok: false; errors: Record<string, string> }

export async function saveAddressAction(
  addressId: string | null,
  input: Record<string, unknown>,
): Promise<FormResult> {
  const sid = await storeId()
  const c = await me(sid)
  const r = await inStore(sid, (tx) =>
    addressId
      ? updateAddress({ storeId: sid, tx }, c.id, addressId, input)
      : createAddress({ storeId: sid, tx }, c.id, input),
  )
  if (!r.ok) return r
  revalidatePath('/account/addresses')
  return { ok: true }
}

export async function deleteAddressAction(addressId: string): Promise<void> {
  const sid = await storeId()
  const c = await me(sid)
  await inStore(sid, (tx) => deleteAddress({ storeId: sid, tx }, c.id, addressId))
  revalidatePath('/account/addresses')
}

export async function defaultAddressAction(addressId: string): Promise<void> {
  const sid = await storeId()
  const c = await me(sid)
  await inStore(sid, (tx) => setDefaultAddress({ storeId: sid, tx }, c.id, addressId))
  revalidatePath('/account/addresses')
}

export async function saveProfileAction(input: Record<string, unknown>): Promise<FormResult> {
  const sid = await storeId()
  const c = await me(sid)
  const r = await inStore(sid, (tx) => updateProfile({ storeId: sid, tx }, c.id, input))
  if (!r.ok) return r
  revalidatePath('/account', 'layout')
  return { ok: true }
}

/** "Buy again": put the order's still-available lines in the cart and open it. */
export async function reorderAction(number: number): Promise<void> {
  const sid = await storeId()
  const c = await me(sid)
  const existing = await readCartId()
  const cartId = await inStore(sid, async (tx) => {
    const ctx = { storeId: sid, tx }
    const lines = await reorderLines(ctx, c.id, number)
    if (lines.length === 0) return null
    const current = existing ? await getCart(ctx, existing) : null
    const id = current?.status === 'open' ? (existing as string) : await createCart(ctx)
    for (const l of lines) await addToCart(ctx, id, l.variantId, l.quantity)
    return id
  })
  if (cartId && cartId !== existing) await writeCartId(cartId)
  revalidatePath('/', 'layout')
  redirect(cartId ? '/cart' : `/account/orders/${number}?reorder=none`)
}
