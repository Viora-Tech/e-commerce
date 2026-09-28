/** SOURCE OF TRUTH: shopper one-time codes by phone and for account deletion — WHAT: mint, deliver and check six digit codes sent by SMS or WhatsApp to sign in with a mobile number, and codes that confirm a signed-in shopper deleting their account (which opens a deletion request and signs them out everywhere) / WHY: Settings → Customer accounts lets merchants offer phone sign-in, and self-service deletion must prove it is really the account holder; email sign-in keeps its own flow in `auth.ts` */
import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { customer, customerOtp } from '@commerce/db'
import { and, desc, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import type { LoginMethod } from '../customer-accounts/client'
import { type LoginChannelDeps, loginChannels } from '../customer-accounts/service'
import {
  decryptCustomerPhone,
  encryptCustomerPhone,
  phoneBlindIndex,
} from '../customers/phone-crypto'
import { recordPrivacyEvent } from '../privacy/audit'
import { createDataRequest } from '../privacy/requests'
import {
  LOGIN_CODE_MAX_ATTEMPTS,
  LOGIN_CODE_RESEND_MS,
  LOGIN_CODE_TTL_MS,
  revokeAllCustomerSessions,
  startCustomerSession,
} from './auth'
import { normaliseMobile } from './schemas'

type OtpPurpose = 'login' | 'delete_account'

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex')

const destinationHash = (storeId: string, purpose: OtpPurpose, destination: string) =>
  sha256(`${storeId}:${purpose}:${destination}`)

const codeHash = (storeId: string, purpose: OtpPurpose, destination: string, code: string) =>
  sha256(`${storeId}:${purpose}:${destination}:${code}`)

type MintResult = { ok: true; code: string } | { ok: false; reason: 'too_soon' }

async function mintCode(
  ctx: StoreContext,
  input: {
    purpose: OtpPurpose
    channel: LoginMethod
    destination: string
    customerId?: string | null | undefined
  },
  now: Date,
): Promise<MintResult> {
  const destHash = destinationHash(ctx.storeId, input.purpose, input.destination)
  const [existing] = await ctx.tx
    .select({ createdAt: customerOtp.createdAt })
    .from(customerOtp)
    .where(and(eq(customerOtp.purpose, input.purpose), eq(customerOtp.destinationHash, destHash)))
  if (existing && now.getTime() - existing.createdAt.getTime() < LOGIN_CODE_RESEND_MS) {
    return { ok: false, reason: 'too_soon' }
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const values = {
    channel: input.channel,
    customerId: input.customerId ?? null,
    codeHash: codeHash(ctx.storeId, input.purpose, input.destination, code),
    attempts: 0,
    expiresAt: new Date(now.getTime() + LOGIN_CODE_TTL_MS),
    createdAt: now,
  }
  await ctx.tx
    .insert(customerOtp)
    .values({ storeId: ctx.storeId, purpose: input.purpose, destinationHash: destHash, ...values })
    .onConflictDoUpdate({
      target: [customerOtp.storeId, customerOtp.purpose, customerOtp.destinationHash],
      set: values,
    })
  return { ok: true, code }
}

type CheckResult =
  | { ok: true; customerId: string | null }
  | { ok: false; reason: 'invalid' | 'expired' | 'locked' }

async function checkCode(
  ctx: StoreContext,
  input: { purpose: OtpPurpose; destination: string; code: unknown },
  now: Date,
): Promise<CheckResult> {
  const code = typeof input.code === 'string' ? input.code.replace(/\s/g, '') : ''
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: 'invalid' }
  const destHash = destinationHash(ctx.storeId, input.purpose, input.destination)
  const [row] = await ctx.tx
    .select()
    .from(customerOtp)
    .where(and(eq(customerOtp.purpose, input.purpose), eq(customerOtp.destinationHash, destHash)))
  if (!row) return { ok: false, reason: 'invalid' }
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'expired' }
  if (row.attempts >= LOGIN_CODE_MAX_ATTEMPTS) return { ok: false, reason: 'locked' }
  const expected = Buffer.from(row.codeHash, 'hex')
  const given = Buffer.from(codeHash(ctx.storeId, input.purpose, input.destination, code), 'hex')
  if (!timingSafeEqual(expected, given)) {
    await ctx.tx
      .update(customerOtp)
      .set({ attempts: row.attempts + 1 })
      .where(eq(customerOtp.id, row.id))
    return { ok: false, reason: row.attempts + 1 >= LOGIN_CODE_MAX_ATTEMPTS ? 'locked' : 'invalid' }
  }
  await ctx.tx.delete(customerOtp).where(eq(customerOtp.id, row.id))
  return { ok: true, customerId: row.customerId }
}

/**
 * Send a code through the store's channels for one method. Synchronous, like
 * email sign-in codes: a queued code could arrive after it expired. Returns how
 * many channels accepted it; zero means the store cannot send by this method.
 */
export async function deliverCustomerCode(
  ctx: StoreContext,
  input: {
    method: LoginMethod
    code: string
    storeName: string
    to: { email?: string; phone?: string }
    template: 'login_code' | 'account_deletion_code'
  },
  deps: LoginChannelDeps,
): Promise<number> {
  const channels = await loginChannels(ctx, input.method, deps)
  // Phone channels only know the sign-in template (WhatsApp authentication templates are generic).
  const template = input.method === 'email' ? input.template : 'login_code'
  let sent = 0
  for (const channel of channels) {
    const r = await channel.send({
      to: input.to,
      template,
      data: {
        storeName: input.storeName,
        customerName: '',
        totalLabel: '',
        lines: [],
        paymentMethodLabel: '',
        code: input.code,
      },
    })
    if (r.ok) sent += 1
  }
  return sent
}

/** "9876543210" → "919876543210": what phone channels take (E.164 without the plus). */
export const channelPhone = (mobile: string): string => `91${mobile}`

export type PhoneCodeRequest =
  | { ok: true; mobile: string; code: string }
  | { ok: false; reason: 'invalid_phone' | 'too_soon' }

/** Mint a sign-in code for an Indian mobile number. The caller delivers it. */
export async function requestPhoneLoginCode(
  ctx: StoreContext,
  rawPhone: unknown,
  method: 'sms' | 'whatsapp',
  now: Date = new Date(),
): Promise<PhoneCodeRequest> {
  const mobile = typeof rawPhone === 'string' ? normaliseMobile(rawPhone) : null
  if (!mobile) return { ok: false, reason: 'invalid_phone' }
  const minted = await mintCode(
    ctx,
    { purpose: 'login', channel: method, destination: mobile },
    now,
  )
  return minted.ok ? { ok: true, mobile, code: minted.code } : minted
}

export type PhoneVerifyResult =
  | { ok: true; token: string; customerId: string; expiresAt: Date; created: boolean }
  | { ok: false; reason: 'invalid' | 'expired' | 'locked' }

/**
 * Check a phone sign-in code. On success the customer with that mobile number
 * (matched on the blind index, never by decrypting) is signed in; a new number
 * becomes a new customer without an email, as a phone checkout would.
 */
export async function verifyPhoneLoginCode(
  ctx: StoreContext,
  rawPhone: unknown,
  rawCode: unknown,
  secret: string,
  now: Date = new Date(),
): Promise<PhoneVerifyResult> {
  const mobile = typeof rawPhone === 'string' ? normaliseMobile(rawPhone) : null
  if (!mobile) return { ok: false, reason: 'invalid' }
  const checked = await checkCode(
    ctx,
    { purpose: 'login', destination: mobile, code: rawCode },
    now,
  )
  if (!checked.ok) return checked
  const index = phoneBlindIndex(mobile, secret)
  const [found] = await ctx.tx
    .select({ id: customer.id })
    .from(customer)
    .where(eq(customer.phoneIndex, index))
    .orderBy(desc(customer.updatedAt))
    .limit(1)
  let customerId = found?.id
  if (!customerId) {
    const [row] = await ctx.tx
      .insert(customer)
      .values({
        storeId: ctx.storeId,
        email: null,
        phone: encryptCustomerPhone(mobile, secret).cipher,
        phoneIndex: index,
      })
      .returning({ id: customer.id })
    customerId = row?.id as string
  }
  const session = await startCustomerSession(ctx, customerId, now)
  return { ...session, created: !found }
}

export type DeletionCodeRequest =
  | {
      ok: true
      code: string
      method: LoginMethod
      to: { email?: string; phone?: string }
      /** Where the code went, masked for the confirmation screen: `a•••@gmail.com`, `•••• 3210`. */
      hint: string
    }
  | { ok: false; reason: 'not_found' | 'no_channel' | 'too_soon' }

function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@')
  return `${local.slice(0, 1)}•••@${domain}`
}

function maskMobile(mobile: string): string {
  return `•••• ${mobile.slice(-4)}`
}

/**
 * Start a self-service account deletion: a code to the customer's email, or,
 * for a phone-only account, to their mobile by the first phone method the
 * store can send. `available` is `availableLoginMethods` for the store.
 */
export async function requestAccountDeletionCode(
  ctx: StoreContext,
  customerId: string,
  available: readonly LoginMethod[],
  secret: string,
  now: Date = new Date(),
): Promise<DeletionCodeRequest> {
  const [cu] = await ctx.tx
    .select({ email: customer.email, phone: customer.phone, anonymisedAt: customer.anonymisedAt })
    .from(customer)
    .where(eq(customer.id, customerId))
  if (!cu || cu.anonymisedAt) return { ok: false, reason: 'not_found' }
  const mobile = normaliseMobile(decryptCustomerPhone(cu.phone, secret) ?? '')
  let method: LoginMethod | null = null
  let to: { email?: string; phone?: string } = {}
  let hint = ''
  if (cu.email && available.includes('email')) {
    method = 'email'
    to = { email: cu.email }
    hint = maskEmail(cu.email)
  } else if (mobile) {
    method = available.find((m) => m !== 'email') ?? null
    to = { phone: channelPhone(mobile) }
    hint = maskMobile(mobile)
  }
  if (!method) return { ok: false, reason: 'no_channel' }
  const minted = await mintCode(
    ctx,
    { purpose: 'delete_account', channel: method, destination: customerId, customerId },
    now,
  )
  if (!minted.ok) return minted
  return { ok: true, code: minted.code, method, to, hint }
}

export type DeletionConfirmResult =
  | { ok: true; requestId: string; requestNumber: number; sessionsEnded: number }
  | { ok: false; reason: 'invalid' | 'expired' | 'locked' }

/**
 * Check the deletion code. On success a deletion request lands in the admin
 * queue (source: account) and every session of this customer ends, so the
 * shopper is signed out on all devices. The erasure itself is the merchant's
 * step in the queue, where what the law says to keep is kept.
 */
export async function confirmAccountDeletion(
  ctx: StoreContext,
  customerId: string,
  rawCode: unknown,
  input: { note?: string | undefined } = {},
  now: Date = new Date(),
): Promise<DeletionConfirmResult> {
  const checked = await checkCode(
    ctx,
    { purpose: 'delete_account', destination: customerId, code: rawCode },
    now,
  )
  if (!checked.ok) return checked
  const { request } = await createDataRequest(ctx, {
    kind: 'delete',
    source: 'account',
    customerId,
    note: input.note,
    actor: { type: 'customer', id: customerId },
    at: now,
  })
  const sessionsEnded = await revokeAllCustomerSessions(ctx, customerId)
  await recordPrivacyEvent(ctx, {
    action: 'account.deletion_requested',
    actor: { type: 'customer', id: customerId },
    customerId,
    dataRequestId: request.id,
    detail: { sessionsEnded, verifiedBy: 'code' },
    at: now,
  })
  return { ok: true, requestId: request.id, requestNumber: request.number, sessionsEnded }
}
