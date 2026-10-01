/** SOURCE OF TRUTH: Truecaller shopper sign-in — WHAT: the Truecaller web SDK flow for mobile browsers (signed request nonce naming the store, the `truecallersdk://` deep link, the server-to-server callback that fetches the verified number, and the one-time pick-up by the browser that started it; an existing customer's number links only after a phone code) / WHY: Indian shoppers on Android can sign in with the number Truecaller already verified, without waiting for an SMS, and a callback must never be trusted to name the store or to point our server at an arbitrary URL */
import { createHmac } from 'node:crypto'
import { customer, customerLoginTicket } from '@commerce/db'
import { and, eq, isNull } from 'drizzle-orm'
import { checkPhoneLoginCode } from '../accounts/otp'
import { normaliseMobile } from '../accounts/schemas'
import type { StoreContext } from '../context'
import { readCapped } from '../net/safe-fetch'
import { linkIdentity, resolveShopperIdentity } from './identities'
import { safeEqual, safeNextPath, sha256Hex } from './tokens'

/*
 * Truecaller SDK for mobile websites ("Truecaller web SDK"), as documented at
 * https://docs.truecaller.com/truecaller-sdk/web/mobile-websites (the docs host was blocked
 * from the build machine; written from the published flow, verify against the portal
 * before switching it on in production):
 *
 *   1. The page opens `truecallersdk://truecallersdk?type=btmsheet&requestNonce=…&partnerKey=…`.
 *      Only Android with the Truecaller app installed answers it; otherwise nothing happens
 *      and the page falls back to another sign-in method.
 *   2. The shopper taps Continue; Truecaller's server POSTs `{ requestId, accessToken,
 *      endpoint }` (or `{ requestId, status: 'user_rejected' | 'use_another_number' }`) to
 *      the callback URL registered for the partner key: `<ACCOUNTS_URL>/truecaller/callback`.
 *   3. Our server GETs `endpoint` with `Authorization: Bearer <accessToken>` for the profile
 *      (phone numbers, name). The page polls until the ticket is ready.
 *
 * Terms: a Truecaller developer account and partner key per app, the shopper's consent
 * screen is Truecaller's, and profile data may only be used to sign the shopper in.
 */

/** A Truecaller request is good for 10 minutes. */
const TRUECALLER_TTL_MS = 10 * 60 * 1000

const NONCE = /^[A-Za-z0-9_-]{59}$/

/**
 * The request nonce names the store and is signed, because the callback arrives from
 * Truecaller with nothing else to go on: 16 bytes store id, 12 random, 16 MAC → 59 chars
 * (Truecaller accepts 8 to 64).
 */
export function truecallerNonce(storeId: string, secret: string, random: Buffer): string {
  const id = Buffer.from(storeId.replace(/-/g, ''), 'hex')
  const body = Buffer.concat([id, random.subarray(0, 12)])
  const mac = createHmac('sha256', secret).update('shopper-login:truecaller').update(body).digest()
  return Buffer.concat([body, mac.subarray(0, 16)]).toString('base64url')
}

/** The store a nonce was minted for, or null when it is not ours. */
export function storeFromTruecallerNonce(nonce: unknown, secret: string): string | null {
  if (typeof nonce !== 'string' || !NONCE.test(nonce)) return null
  const raw = Buffer.from(nonce, 'base64url')
  if (raw.length !== 44) return null
  const body = raw.subarray(0, 28)
  const mac = createHmac('sha256', secret).update('shopper-login:truecaller').update(body).digest()
  if (!safeEqual(raw.subarray(28).toString('hex'), mac.subarray(0, 16).toString('hex'))) return null
  const hex = body.subarray(0, 16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** The deep link that opens Truecaller's bottom sheet. */
export function truecallerDeepLink(input: {
  nonce: string
  partnerKey: string
  partnerName: string
  privacyUrl: string
  termsUrl: string
  lang?: string | undefined
}): string {
  const q = new URLSearchParams({
    type: 'btmsheet',
    requestNonce: input.nonce,
    partnerKey: input.partnerKey,
    partnerName: input.partnerName,
    lang: input.lang ?? 'en',
    privacyUrl: input.privacyUrl,
    termsUrl: input.termsUrl,
    loginPrefix: 'continue',
    loginSuffix: 'login',
    ctaPrefix: 'continuewith',
    ctaColor: '#0087ff',
    ctaTextColor: '#ffffff',
    btnShape: 'round',
    skipOption: 'useanothermethod',
    ttl: '10000',
  })
  return `truecallersdk://truecallersdk?${q.toString()}`
}

/** Open a pending Truecaller request for this browser. The caller keeps the nonce in a cookie. */
export async function startTruecaller(
  ctx: StoreContext,
  input: { secret: string; random: Buffer; nextPath: string; remember: boolean },
  now: Date = new Date(),
): Promise<string> {
  const nonce = truecallerNonce(ctx.storeId, input.secret, input.random)
  await ctx.tx.insert(customerLoginTicket).values({
    storeId: ctx.storeId,
    kind: 'truecaller',
    tokenHash: sha256Hex(nonce),
    status: 'pending',
    nextPath: safeNextPath(input.nextPath),
    remember: input.remember,
    expiresAt: new Date(now.getTime() + TRUECALLER_TTL_MS),
    createdAt: now,
  })
  return nonce
}

/** Only Truecaller's own https hosts; the callback body cannot point our server elsewhere. */
export function isTruecallerEndpoint(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()
    return (
      u.protocol === 'https:' &&
      !u.port &&
      !u.username &&
      (host === 'truecaller.com' || host.endsWith('.truecaller.com'))
    )
  } catch {
    return false
  }
}

type TruecallerProfile = {
  phoneNumbers?: unknown
  name?: { first?: unknown; last?: unknown } | undefined
}

/** The Indian mobile from a Truecaller profile (`919876543210` → `9876543210`). */
export function mobileFromProfile(profile: TruecallerProfile): string | null {
  const list = Array.isArray(profile.phoneNumbers) ? profile.phoneNumbers : []
  const first = list[0]
  if (typeof first !== 'number' && typeof first !== 'string') return null
  return normaliseMobile(String(first))
}

export type TruecallerCallback = {
  requestId?: unknown
  accessToken?: unknown
  endpoint?: unknown
  status?: unknown
}

export type TruecallerDeps = {
  secret: string
  /** `fetch`; tests inject a fake. Never called for an endpoint outside truecaller.com. */
  fetch: (
    url: string,
    init: { headers: Record<string, string>; redirect: 'error'; signal: AbortSignal },
  ) => Promise<Response>
}

/**
 * Truecaller's server callback. Fills the pending ticket with the customer for the
 * verified number (found by blind index, or created, as a phone code sign-in does), or
 * marks it failed. The ticket must be this store's, pending and unexpired.
 */
export async function completeTruecaller(
  ctx: StoreContext,
  body: TruecallerCallback,
  deps: TruecallerDeps,
  now: Date = new Date(),
): Promise<'ready' | 'verify_phone' | 'failed' | 'ignored'> {
  const nonce = body.requestId
  if (typeof nonce !== 'string' || storeFromTruecallerNonce(nonce, deps.secret) !== ctx.storeId) {
    return 'ignored'
  }
  const [ticket] = await ctx.tx
    .select()
    .from(customerLoginTicket)
    .where(
      and(
        eq(customerLoginTicket.tokenHash, sha256Hex(nonce)),
        eq(customerLoginTicket.kind, 'truecaller'),
      ),
    )
  if (ticket?.status !== 'pending' || ticket.expiresAt.getTime() <= now.getTime()) {
    return 'ignored'
  }
  const fail = async () => {
    await ctx.tx
      .update(customerLoginTicket)
      .set({ status: 'failed' })
      .where(eq(customerLoginTicket.id, ticket.id))
    return 'failed' as const
  }
  if (typeof body.accessToken !== 'string' || !isTruecallerEndpoint(body.endpoint)) return fail()
  let profile: TruecallerProfile
  try {
    // No redirects (a truecaller.com URL must not bounce us elsewhere), 5 s, 64 KB.
    const res = await deps.fetch(body.endpoint, {
      headers: { Authorization: `Bearer ${body.accessToken}`, 'Cache-Control': 'no-cache' },
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return fail()
    const raw = await readCapped(res, 64 * 1024)
    if (!raw) return fail()
    profile = JSON.parse(new TextDecoder().decode(raw)) as TruecallerProfile
  } catch {
    return fail()
  }
  const mobile = mobileFromProfile(profile)
  if (!mobile) return fail()
  const first = typeof profile.name?.first === 'string' ? profile.name.first : ''
  const last = typeof profile.name?.last === 'string' ? profile.name.last : ''
  const resolved = await resolveShopperIdentity(
    ctx,
    {
      provider: 'truecaller',
      subject: mobile,
      mobile,
      // Truecaller does not verify emails; a profile email is never used.
      email: null,
      emailVerified: false,
      name: `${first} ${last}`.trim() || null,
    },
    { secret: deps.secret, now },
  )
  if (resolved.kind === 'verify_phone') {
    // An existing customer's number, never used with Truecaller here: a phone code first (D-03).
    await ctx.tx
      .update(customerLoginTicket)
      .set({
        status: 'verify_phone',
        customerId: resolved.customerId,
        provider: 'truecaller',
        subject: mobile,
        name: `${first} ${last}`.trim() || null,
      })
      .where(eq(customerLoginTicket.id, ticket.id))
    return 'verify_phone'
  }
  if (resolved.kind !== 'signed_in') return fail()
  await ctx.tx
    .update(customerLoginTicket)
    .set({ status: 'ready', customerId: resolved.customerId })
    .where(eq(customerLoginTicket.id, ticket.id))
  return 'ready'
}

export type TruecallerPoll =
  | { state: 'pending' }
  | { state: 'failed' }
  | { state: 'ready'; customerId: string; nextPath: string; remember: boolean }
  /**
   * The number belongs to an existing customer: the browser must enter the code sent to
   * it. `sendTo` is set once, on the poll that should send the code (the caller sends it
   * and never shows the number to the browser, which may not be the phone's owner).
   */
  | { state: 'verify_phone'; sendTo: string | null }

/** The starting browser asks whether Truecaller answered. A ready ticket is spent here. */
export async function pollTruecaller(
  ctx: StoreContext,
  nonce: unknown,
  now: Date = new Date(),
): Promise<TruecallerPoll> {
  if (typeof nonce !== 'string' || !NONCE.test(nonce)) return { state: 'failed' }
  const where = and(
    eq(customerLoginTicket.tokenHash, sha256Hex(nonce)),
    eq(customerLoginTicket.kind, 'truecaller'),
  )
  const [ticket] = await ctx.tx.select().from(customerLoginTicket).where(where)
  if (!ticket || ticket.expiresAt.getTime() <= now.getTime() || ticket.status === 'failed') {
    return { state: 'failed' }
  }
  if (ticket.status === 'phone_code_sent') return { state: 'verify_phone', sendTo: null }
  if (ticket.status === 'verify_phone') {
    // Only one poll wins the switch, so the code goes out once.
    const [claimed] = await ctx.tx
      .update(customerLoginTicket)
      .set({ status: 'phone_code_sent' })
      .where(and(where, eq(customerLoginTicket.status, 'verify_phone')))
      .returning({ subject: customerLoginTicket.subject })
    return { state: 'verify_phone', sendTo: claimed?.subject ?? null }
  }
  if (ticket.status !== 'ready' || !ticket.customerId) return { state: 'pending' }
  const [spent] = await ctx.tx.delete(customerLoginTicket).where(where).returning()
  if (!spent?.customerId) return { state: 'failed' }
  return {
    state: 'ready',
    customerId: spent.customerId,
    nextPath: safeNextPath(spent.nextPath),
    remember: spent.remember,
  }
}

export type TruecallerPhoneConfirm =
  | { ok: true; customerId: string; nextPath: string; remember: boolean }
  | { ok: false; reason: 'invalid' | 'expired' | 'locked' | 'failed' }

/**
 * The code sent to the Truecaller number of an existing customer (D-03). Right: Truecaller
 * is linked to that customer (so later Truecaller sign-ins are one tap), the phone counts
 * as proven, and the ticket is spent. A lockout or an expired request ends the ticket; the
 * shopper starts again or signs in another way.
 */
export async function confirmTruecallerPhone(
  ctx: StoreContext,
  nonce: unknown,
  code: unknown,
  now: Date = new Date(),
): Promise<TruecallerPhoneConfirm> {
  if (typeof nonce !== 'string' || !NONCE.test(nonce)) return { ok: false, reason: 'failed' }
  const where = and(
    eq(customerLoginTicket.tokenHash, sha256Hex(nonce)),
    eq(customerLoginTicket.kind, 'truecaller'),
  )
  const [ticket] = await ctx.tx.select().from(customerLoginTicket).where(where).for('update')
  if (ticket?.status !== 'phone_code_sent' || !ticket.customerId || !ticket.subject) {
    return { ok: false, reason: 'failed' }
  }
  if (ticket.expiresAt.getTime() <= now.getTime()) {
    await ctx.tx.delete(customerLoginTicket).where(where)
    return { ok: false, reason: 'expired' }
  }
  const checked = await checkPhoneLoginCode(ctx, ticket.subject, code, now)
  if (!checked.ok) {
    if (checked.reason !== 'invalid') await ctx.tx.delete(customerLoginTicket).where(where)
    return checked
  }
  await ctx.tx.delete(customerLoginTicket).where(where)
  const [cu] = await ctx.tx
    .select({ id: customer.id })
    .from(customer)
    .where(and(eq(customer.id, ticket.customerId), isNull(customer.anonymisedAt)))
  if (!cu) return { ok: false, reason: 'failed' }
  await linkIdentity(
    ctx,
    cu.id,
    {
      provider: 'truecaller',
      subject: ticket.subject,
      mobile: ticket.subject,
      email: null,
      emailVerified: false,
      name: ticket.name,
    },
    now,
  )
  await ctx.tx.update(customer).set({ phoneVerifiedAt: now }).where(eq(customer.id, cu.id))
  return {
    ok: true,
    customerId: cu.id,
    nextPath: safeNextPath(ticket.nextPath),
    remember: ticket.remember,
  }
}
