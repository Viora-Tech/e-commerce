/** SOURCE OF TRUTH: phone sign-in and account deletion tests — which sign-in methods a store can offer, SMS and WhatsApp codes through dev channels, phone-only customers, lockout, and self-service deletion opening a request and ending every session */
import {
  createDb,
  customer,
  customerOtp,
  customerSession,
  dataRequest,
  privacyAuditEvent,
  type StoreTx,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { Message, NotificationChannel } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  availableLoginMethods,
  LoginMethodUnavailable,
  loadCustomerAccountSettings,
  saveCustomerAccountSettings,
} from '../customer-accounts/service'
import {
  decryptCustomerPhone,
  encryptCustomerPhone,
  phoneBlindIndex,
} from '../customers/phone-crypto'
import { LogSmsChannel } from '../providers/log-sms-channel'
import {
  customerForSession,
  LOGIN_CODE_MAX_ATTEMPTS,
  requestLoginCode,
  verifyLoginCode,
} from './auth'
import {
  confirmAccountDeletion,
  deliverCustomerCode,
  requestAccountDeletionCode,
  requestPhoneLoginCode,
  verifyPhoneLoginCode,
} from './otp'

/** Wrong guesses carry over resends for an hour (`attemptsCarriedOver`). */
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-only-settings-secret-value'
const NOW = new Date('2026-09-27T10:00:00Z')

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

const run = <T>(storeId: string, fn: (ctx: { storeId: string; tx: StoreTx }) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

async function makeStore(): Promise<string> {
  const [s] = await owner.insert(store).values({ slug: 'waimers', name: 'Waimers' }).returning()
  return s?.id as string
}

/** Channels that record what they would send; nothing leaves the test. */
function recorder(
  id: string,
  requires: 'email' | 'phone',
  medium?: 'sms' | 'whatsapp',
): NotificationChannel & { sent: Message[] } {
  const sent: Message[] = []
  return {
    id,
    label: id,
    requires,
    ...(medium ? { medium } : {}),
    sent,
    send: async (m) => {
      sent.push(m)
      return { ok: true, providerRef: `${id}-${sent.length}` }
    },
  }
}

describe('sign-in methods a store can offer', () => {
  it('follows the enabled apps, and dev log channels only count outside production', async () => {
    const storeId = await makeStore()
    const email = recorder('ses', 'email')
    const whatsapp = recorder('whatsapp', 'phone')
    const logSms = new LogSmsChannel(() => {})
    const deps = (channels: NotificationChannel[], allowDevChannels: boolean) => ({
      registry: undefined as never,
      settingsSecret: SECRET,
      allowDevChannels,
      channels,
    })
    expect(
      await run(storeId, (ctx) =>
        availableLoginMethods(ctx, deps([email, whatsapp, logSms], true)),
      ),
    ).toEqual(['email', 'sms', 'whatsapp'])
    expect(
      await run(storeId, (ctx) =>
        availableLoginMethods(ctx, deps([email, whatsapp, logSms], false)),
      ),
    ).toEqual(['email', 'whatsapp'])
  })

  it('refuses to save a method the store cannot send', async () => {
    const storeId = await makeStore()
    await expect(
      run(storeId, (ctx) =>
        saveCustomerAccountSettings(ctx, { loginMethods: ['email', 'sms'] }, ['email']),
      ),
    ).rejects.toThrow(LoginMethodUnavailable)
    await run(storeId, (ctx) =>
      saveCustomerAccountSettings(
        ctx,
        { checkout: 'account_required', loginMethods: ['whatsapp', 'email'] },
        ['email', 'whatsapp'],
      ),
    )
    expect(await run(storeId, (ctx) => loadCustomerAccountSettings(ctx))).toMatchObject({
      checkout: 'account_required',
      loginMethods: ['email', 'whatsapp'],
    })
  })
})

describe('phone sign-in', () => {
  it('sends a code by SMS through the dev channel, then signs in a new phone-only customer', async () => {
    const storeId = await makeStore()
    const printed: string[] = []
    const sms = new LogSmsChannel((line) => printed.push(line))
    const req = await run(storeId, (ctx) =>
      requestPhoneLoginCode(ctx, '+91 98765 43210', 'sms', NOW),
    )
    if (!req.ok) throw new Error(req.reason)
    expect(req.mobile).toBe('9876543210')
    const sent = await run(storeId, (ctx) =>
      deliverCustomerCode(
        ctx,
        {
          method: 'sms',
          code: req.code,
          storeName: 'Waimers',
          to: { phone: '919876543210' },
          template: 'login_code',
        },
        {
          registry: undefined as never,
          settingsSecret: SECRET,
          allowDevChannels: true,
          channels: [sms],
        },
      ),
    )
    expect(sent).toBe(1)
    expect(printed[0]).toContain(`to=919876543210 ${req.code} is your Waimers code`)
    // Only hashes are stored.
    const [otp] = await owner.select().from(customerOtp)
    expect(otp?.destinationHash).not.toContain('9876543210')
    expect(otp?.codeHash).not.toContain(req.code)

    const again = await run(storeId, (ctx) => requestPhoneLoginCode(ctx, '9876543210', 'sms', NOW))
    expect(again).toEqual({ ok: false, reason: 'too_soon' })

    const res = await run(storeId, (ctx) =>
      verifyPhoneLoginCode(ctx, '9876543210', req.code, SECRET, NOW),
    )
    if (!res.ok) throw new Error(res.reason)
    expect(res.created).toBe(true)
    const [cu] = await owner.select().from(customer)
    expect(cu?.email).toBeNull()
    expect(decryptCustomerPhone(cu?.phone ?? null, SECRET)).toBe('9876543210')
    const me = await run(storeId, (ctx) => customerForSession(ctx, res.token, SECRET, NOW))
    expect(me).toMatchObject({ id: res.customerId, email: null, phone: '9876543210' })
    // The code works once.
    expect(
      await run(storeId, (ctx) => verifyPhoneLoginCode(ctx, '9876543210', req.code, SECRET, NOW)),
    ).toEqual({ ok: false, reason: 'invalid' })
  })

  it('finds the existing customer by mobile and locks after too many wrong codes', async () => {
    const storeId = await makeStore()
    const first = await run(storeId, (ctx) =>
      requestPhoneLoginCode(ctx, '9876543210', 'whatsapp', NOW),
    )
    if (!first.ok) throw new Error(first.reason)
    const signedUp = await run(storeId, (ctx) =>
      verifyPhoneLoginCode(ctx, '9876543210', first.code, SECRET, NOW),
    )
    const later = new Date(NOW.getTime() + 60_000)
    const second = await run(storeId, (ctx) =>
      requestPhoneLoginCode(ctx, '09876543210', 'whatsapp', later),
    )
    if (!second.ok || !signedUp.ok) throw new Error('setup')
    for (let i = 0; i < LOGIN_CODE_MAX_ATTEMPTS - 1; i += 1) {
      await run(storeId, (ctx) => verifyPhoneLoginCode(ctx, '9876543210', '000000', SECRET, later))
    }
    const wrong = second.code === '111111' ? '222222' : '111111'
    expect(
      await run(storeId, (ctx) => verifyPhoneLoginCode(ctx, '9876543210', wrong, SECRET, later)),
    ).toEqual({ ok: false, reason: 'locked' })

    // A resent code does not reset the wrong guesses; they clear after the window.
    expect(
      await run(storeId, (ctx) =>
        requestPhoneLoginCode(ctx, '9876543210', 'whatsapp', new Date(later.getTime() + 60_000)),
      ),
    ).toEqual({ ok: false, reason: 'too_soon' })
    const afterWindow = new Date(later.getTime() + ATTEMPT_WINDOW_MS)
    const third = await run(storeId, (ctx) =>
      requestPhoneLoginCode(ctx, '9876543210', 'whatsapp', afterWindow),
    )
    if (!third.ok) throw new Error(third.reason)
    const back = await run(storeId, (ctx) =>
      verifyPhoneLoginCode(ctx, '9876543210', third.code, SECRET, afterWindow),
    )
    expect(back).toMatchObject({ ok: true, customerId: signedUp.customerId, created: false })
    expect(await owner.select().from(customer)).toHaveLength(1)
  })

  it('never signs in as a customer whose phone was only typed at checkout', async () => {
    const storeId = await makeStore()
    // What a guest checkout with the victim's email and the attacker's mobile leaves behind.
    const [victim] = await owner
      .insert(customer)
      .values({
        storeId,
        email: 'victim@example.com',
        phone: encryptCustomerPhone('9876543210', SECRET).cipher,
        phoneIndex: phoneBlindIndex('9876543210', SECRET),
      })
      .returning()
    const req = await run(storeId, (ctx) =>
      requestPhoneLoginCode(ctx, '9876543210', 'whatsapp', NOW),
    )
    if (!req.ok) throw new Error(req.reason)
    const res = await run(storeId, (ctx) =>
      verifyPhoneLoginCode(ctx, '9876543210', req.code, SECRET, NOW),
    )
    expect(res).toMatchObject({ ok: true, created: true })
    if (!res.ok) throw new Error('sign-in')
    expect(res.customerId).not.toBe(victim?.id)
  })

  it('rejects numbers that are not Indian mobiles', async () => {
    const storeId = await makeStore()
    expect(await run(storeId, (ctx) => requestPhoneLoginCode(ctx, '12345', 'sms', NOW))).toEqual({
      ok: false,
      reason: 'invalid_phone',
    })
  })
})

describe('self-service account deletion', () => {
  async function signedIn(storeId: string) {
    const req = await run(storeId, (ctx) => requestLoginCode(ctx, 'asha@example.com', NOW))
    if (!req.ok) throw new Error(req.reason)
    const res = await run(storeId, (ctx) => verifyLoginCode(ctx, 'asha@example.com', req.code, NOW))
    if (!res.ok) throw new Error(res.reason)
    return res
  }

  it('confirms with a code, opens a deletion request, and signs out everywhere', async () => {
    const storeId = await makeStore()
    const session = await signedIn(storeId)
    await signedIn(storeId) // a second device
    const req = await run(storeId, (ctx) =>
      requestAccountDeletionCode(ctx, session.customerId, ['email'], SECRET, NOW),
    )
    if (!req.ok) throw new Error(req.reason)
    expect(req).toMatchObject({ method: 'email', to: { email: 'asha@example.com' } })
    expect(req.hint).toBe('a•••@example.com')

    expect(
      await run(storeId, (ctx) =>
        confirmAccountDeletion(ctx, session.customerId, '000000', {}, NOW),
      ),
    ).toEqual({ ok: false, reason: 'invalid' })
    const done = await run(storeId, (ctx) =>
      confirmAccountDeletion(ctx, session.customerId, req.code, { note: 'Too many emails' }, NOW),
    )
    expect(done).toMatchObject({ ok: true, requestNumber: 1, sessionsEnded: 2 })

    const [request] = await owner.select().from(dataRequest)
    expect(request).toMatchObject({
      kind: 'delete',
      source: 'account',
      status: 'open',
      customerId: session.customerId,
      note: 'Too many emails',
    })
    expect(await owner.select().from(customerSession)).toHaveLength(0)
    expect(
      await run(storeId, (ctx) => customerForSession(ctx, session.token, SECRET, NOW)),
    ).toBeNull()
    const audit = await owner
      .select({ action: privacyAuditEvent.action, actorType: privacyAuditEvent.actorType })
      .from(privacyAuditEvent)
      .orderBy(privacyAuditEvent.createdAt, privacyAuditEvent.id)
    expect(audit).toEqual([
      { action: 'request.created', actorType: 'customer' },
      { action: 'account.deletion_requested', actorType: 'customer' },
    ])
  })

  it('sends a phone-only account its code by the first phone method, and says when there is none', async () => {
    const storeId = await makeStore()
    const req = await run(storeId, (ctx) => requestPhoneLoginCode(ctx, '9876543210', 'sms', NOW))
    if (!req.ok) throw new Error(req.reason)
    const res = await run(storeId, (ctx) =>
      verifyPhoneLoginCode(ctx, '9876543210', req.code, SECRET, NOW),
    )
    if (!res.ok) throw new Error(res.reason)
    const code = await run(storeId, (ctx) =>
      requestAccountDeletionCode(ctx, res.customerId, ['email', 'whatsapp'], SECRET, NOW),
    )
    expect(code).toMatchObject({
      ok: true,
      method: 'whatsapp',
      to: { phone: '919876543210' },
      hint: '•••• 3210',
    })
    const none = await run(storeId, (ctx) =>
      requestAccountDeletionCode(
        ctx,
        res.customerId,
        ['email'],
        SECRET,
        new Date(NOW.getTime() + 60_000),
      ),
    )
    expect(none).toEqual({ ok: false, reason: 'no_channel' })
    const [cu] = await owner.select().from(customer).where(eq(customer.id, res.customerId))
    expect(cu?.anonymisedAt).toBeNull()
  })
})
