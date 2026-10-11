import { createMerchantAuth } from '@commerce/auth'
import { recordMemberSignIn } from '@commerce/core'
import { authSchema, createDb } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { Message, NotificationChannel } from '@commerce/notifications'
import { call } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const codes: { email: string; otp: string; type: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    codes.push(m)
  },
  sendInvite: async () => undefined,
  onSignIn: (event) => recordMemberSignIn(app, event),
})

/** Messages the fake platform account "sent". */
const notices: Message[] = []
const channel: NotificationChannel = {
  id: 'platform_email',
  label: 'Email (sent by the platform)',
  requires: 'email',
  async send(message) {
    notices.push(message)
    return { ok: true, providerRef: 'ses-test' }
  },
}

async function signIn(email: string, userAgent = 'Mozilla/5.0 (Windows NT 10.0) Chrome/129.0') {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: codes.at(-1)?.otp as string },
    headers: new Headers({ 'user-agent': userAgent }),
    asResponse: true,
  })
  return new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
}

function ctx(headers: Headers): ApiContext {
  return {
    db: app,
    auth,
    headers,
    notifications: { add: async () => undefined },
    platformEmail: {
      transport: {
        fromEmail: 'no-reply@example.com',
        fromName: 'Sellverse',
        channel: () => channel,
      },
    },
  }
}

beforeEach(async () => {
  await resetDb(owner)
  codes.length = 0
  notices.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('sessions', () => {
  it('lists only my devices, marks this one, and never sends a token', async () => {
    const laptop = await signIn('asha@example.com')
    await signIn('asha@example.com', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/604.1')
    await signIn('bilal@example.com')

    const sessions = await call(appRouter.account.sessions, {}, { context: ctx(laptop) })
    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toMatchObject({ current: true, device: { browser: 'Chrome' } })
    expect(sessions[1]).toMatchObject({ current: false, device: { os: 'iPhone', kind: 'phone' } })
    expect(JSON.stringify(sessions)).not.toMatch(/token/i)
  })

  it("signs one of my other devices out, but never someone else's", async () => {
    const laptop = await signIn('asha@example.com')
    const phone = await signIn('asha@example.com')
    const other = await signIn('bilal@example.com')

    const mine = await call(appRouter.account.sessions, {}, { context: ctx(laptop) })
    const phoneSession = mine.find((s) => !s.current)
    const theirs = await call(appRouter.account.sessions, {}, { context: ctx(other) })

    await expect(
      call(
        appRouter.account.revokeSession,
        { id: theirs[0]?.id as string },
        { context: ctx(laptop) },
      ),
    ).rejects.toThrow('already signed out')
    await expect(
      call(
        appRouter.account.revokeSession,
        { id: mine.find((s) => s.current)?.id as string },
        {
          context: ctx(laptop),
        },
      ),
    ).rejects.toThrow('Log out')

    await call(
      appRouter.account.revokeSession,
      { id: phoneSession?.id as string },
      {
        context: ctx(laptop),
      },
    )
    const left = await owner.select().from(authSchema.session)
    expect(left.map((s) => s.id)).not.toContain(phoneSession?.id)
    expect(await call(appRouter.account.sessions, {}, { context: ctx(other) })).toHaveLength(1)
    expect(phone).toBeTruthy()
  })

  it('signs every other device out and keeps this one', async () => {
    const laptop = await signIn('asha@example.com')
    await signIn('asha@example.com')
    await signIn('asha@example.com')
    await call(appRouter.account.revokeOtherSessions, {}, { context: ctx(laptop) })
    const sessions = await call(appRouter.account.sessions, {}, { context: ctx(laptop) })
    expect(sessions.map((s) => s.current)).toEqual([true])
  })
})

describe('recent sign-ins', () => {
  it('records each sign-in for that member only, newest first', async () => {
    const a = await signIn('asha@example.com')
    await signIn('bilal@example.com')
    const { email, recentSignIns } = await call(appRouter.account.security, {}, { context: ctx(a) })
    expect(email).toBe('asha@example.com')
    expect(recentSignIns).toHaveLength(1)
    expect(recentSignIns[0]).toMatchObject({
      method: 'email_otp',
      current: true,
      device: { browser: 'Chrome', os: 'Windows' },
      // IP tracking is off without a trusted proxy, so nothing is stored.
      ipMasked: null,
      city: null,
    })
  })
})

describe('Google sign-in', () => {
  it('says when my Google account was linked, and only mine', async () => {
    const a = await signIn('asha@example.com')
    const b = await signIn('bilal@example.com')
    const before = await call(appRouter.account.security, {}, { context: ctx(a) })
    // No MERCHANT_GOOGLE_* keys in the test env: the admin does not offer Google.
    expect(before.google).toEqual({ available: false, linkedAt: null })

    const [asha] = await owner
      .select({ id: authSchema.user.id })
      .from(authSchema.user)
      .where(eq(authSchema.user.email, 'asha@example.com'))
    await owner.insert(authSchema.account).values({
      id: 'asha-google',
      accountId: 'google-sub-1',
      providerId: 'google',
      userId: asha?.id as string,
      accessToken: 'secret-token',
    })
    const after = await call(appRouter.account.security, {}, { context: ctx(a) })
    expect(after.google.linkedAt).toBeInstanceOf(Date)
    expect(JSON.stringify(after)).not.toContain('secret-token')
    expect(JSON.stringify(after)).not.toContain('google-sub-1')
    const other = await call(appRouter.account.security, {}, { context: ctx(b) })
    expect(other.google.linkedAt).toBeNull()
  })
})

describe('change email', () => {
  it('sends a code to the new address, switches on the right code and tells the old address', async () => {
    const a = await signIn('asha@example.com')
    await call(
      appRouter.account.requestEmailChange,
      { newEmail: 'Asha.New@Example.com' },
      { context: ctx(a) },
    )
    const sent = codes.at(-1)
    expect(sent).toMatchObject({ email: 'asha.new@example.com', type: 'change-email' })

    await expect(
      call(
        appRouter.account.confirmEmailChange,
        { newEmail: 'asha.new@example.com', otp: sent?.otp === '000000' ? '111111' : '000000' },
        { context: ctx(a) },
      ),
    ).rejects.toThrow()

    await call(
      appRouter.account.confirmEmailChange,
      { newEmail: 'asha.new@example.com', otp: sent?.otp as string },
      { context: ctx(a) },
    )
    const [row] = await owner
      .select({ email: authSchema.user.email })
      .from(authSchema.user)
      .where(eq(authSchema.user.email, 'asha.new@example.com'))
    expect(row?.email).toBe('asha.new@example.com')
    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatchObject({
      to: { email: 'asha@example.com' },
      template: 'email_changed',
      data: { emailChange: { newEmail: 'a•••@example.com' } },
    })
  })

  it("sends nothing for an email someone else already uses, so it can't be taken", async () => {
    const a = await signIn('asha@example.com')
    await signIn('bilal@example.com')
    codes.length = 0
    await call(
      appRouter.account.requestEmailChange,
      { newEmail: 'bilal@example.com' },
      { context: ctx(a) },
    )
    expect(codes).toHaveLength(0)
    await expect(
      call(
        appRouter.account.confirmEmailChange,
        { newEmail: 'bilal@example.com', otp: '123456' },
        { context: ctx(a) },
      ),
    ).rejects.toThrow()
  })

  it('refuses the same email and rate-limits code requests', async () => {
    const a = await signIn('asha@example.com')
    await expect(
      call(
        appRouter.account.requestEmailChange,
        { newEmail: 'asha@example.com' },
        { context: ctx(a) },
      ),
    ).rejects.toThrow('already your email')
    for (let i = 0; i < 5; i += 1) {
      await call(
        appRouter.account.requestEmailChange,
        { newEmail: `new${i}@example.com` },
        { context: ctx(a) },
      )
    }
    await expect(
      call(
        appRouter.account.requestEmailChange,
        { newEmail: 'six@example.com' },
        { context: ctx(a) },
      ),
    ).rejects.toThrow('Too many codes')
  })
})
