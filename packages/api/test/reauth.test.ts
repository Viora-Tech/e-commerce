/**
 * Step-up re-auth router (A5, task 3): the `reauth.*` procedures the admin dialog drives —
 * status, OTP send + verify, and passkey options. Full passkey signature verification is covered
 * in `@commerce/auth`'s step-up tests; here we drive the orpc wiring.
 */
import { createMerchantAuth } from '@commerce/auth'
import { authSchema, createDb } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const sent: { email: string; otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})

// A platform email that captures the code it was asked to send instead of mailing it.
let capturedCode = ''
const platformEmail = {
  transport: {
    fromEmail: 'noreply@test',
    fromName: 'Test',
    channel: () => ({
      send: async ({ data }: { data: { code?: string } }) => {
        capturedCode = data.code ?? ''
        return { ok: true }
      },
    }),
  },
} as unknown as ApiContext['platformEmail']

async function signInSession(email: string): Promise<{ headers: Headers; userId: string }> {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const s = await auth.api.getSession({ headers })
  return { headers, userId: s?.user.id as string }
}

function ctx(headers: Headers, extra?: Partial<ApiContext>): ApiContext {
  return { db: app, auth, headers, notifications: { add: async () => undefined }, ...extra }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
  capturedCode = ''
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('reauth.status', () => {
  it('offers OTP without a passkey and passkey once one is enrolled', async () => {
    const a = await signInSession('owner@example.com')
    expect(
      (await call(appRouter.reauth.status, undefined, { context: ctx(a.headers) })).method,
    ).toBe('otp')
    await owner.insert(authSchema.passkey).values({
      id: 'pk-1',
      name: 'Key',
      publicKey: Buffer.from([1, 2, 3]).toString('base64'),
      userId: a.userId,
      credentialID: 'cred-1',
      counter: 0,
      deviceType: 'multiDevice',
      backedUp: true,
      transports: 'internal',
    })
    expect(
      (await call(appRouter.reauth.status, undefined, { context: ctx(a.headers) })).method,
    ).toBe('passkey')
  })
})

describe('reauth OTP', () => {
  it('mails a code, verifies it, and marks the session fresh; a replay fails', async () => {
    const a = await signInSession('owner@example.com')
    const stale = ctx(a.headers, { platformEmail })

    expect(await call(appRouter.reauth.sendOtp, undefined, { context: stale })).toEqual({
      ok: true,
    })
    expect(capturedCode).toMatch(/^\d{6}$/)

    expect(
      await call(appRouter.reauth.verify, { otp: capturedCode }, { context: ctx(a.headers) }),
    ).toEqual({ ok: true })
    expect(
      (await call(appRouter.reauth.status, undefined, { context: ctx(a.headers) })).fresh,
    ).toBe(true)

    // The consumed code cannot be replayed.
    await expect(
      call(appRouter.reauth.verify, { otp: capturedCode }, { context: ctx(a.headers) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('rejects a wrong code', async () => {
    const a = await signInSession('owner@example.com')
    await call(appRouter.reauth.sendOtp, undefined, { context: ctx(a.headers, { platformEmail }) })
    const wrong = capturedCode === '000000' ? '111111' : '000000'
    await expect(
      call(appRouter.reauth.verify, { otp: wrong }, { context: ctx(a.headers) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

describe('reauth.passkeyOptions', () => {
  it('returns rpID-bound options that offer the member’s own credential', async () => {
    const a = await signInSession('owner@example.com')
    await owner.insert(authSchema.passkey).values({
      id: 'pk-1',
      name: 'Key',
      publicKey: Buffer.from([1, 2, 3]).toString('base64'),
      userId: a.userId,
      credentialID: 'cred-1',
      counter: 0,
      deviceType: 'multiDevice',
      backedUp: true,
      transports: 'internal',
    })
    const options = await call(appRouter.reauth.passkeyOptions, undefined, {
      context: ctx(a.headers, { appUrl: 'http://localhost:3200' }),
    })
    expect(options.rpId).toBe('localhost')
    expect(options.userVerification).toBe('required')
    expect(options.allowCredentials?.map((c) => c.id)).toContain('cred-1')
  })
})
