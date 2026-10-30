/**
 * Step-up re-authentication core (attack-catalog A5, task 2). An already-signed-in merchant
 * re-verifies with an OTP or a passkey before a sensitive action; a success stamps
 * `session.reauthenticated_at = now()` on the SAME session (no new session is minted). These
 * tests drive the core against the real merchant auth + a real session row.
 *
 * The browser's WebAuthn signature needs a real authenticator, so `verifyAuthenticationResponse`
 * is stubbed (it reports success and records what it was asked to expect). Everything about the
 * challenge — where it lives, single use, expiry, rpID binding — is ours and is tested for real.
 */
import { authSchema, createDb } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMerchantAuth } from '../src/merchant'

const verifyCalls: {
  expectedChallenge: string
  expectedRPID: string
  requireUserVerification?: boolean
}[] = []
vi.mock('@simplewebauthn/server', async (importActual) => {
  const actual = await importActual<typeof import('@simplewebauthn/server')>()
  return {
    ...actual,
    verifyAuthenticationResponse: vi.fn(async (opts: (typeof verifyCalls)[number]) => {
      verifyCalls.push(opts)
      return { verified: true, authenticationInfo: { newCounter: 7 } }
    }),
  }
})

// Imported after vi.mock so the module picks up the stubbed verify.
const stepUp = await import('../src/step-up')

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const RP = { rpId: 'localhost', origin: 'http://localhost:3200' }
const ANSWER = { id: 'cred-1', rawId: 'cred-1', response: {}, type: 'public-key' }

const sent: { email: string; otp: string; type: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})

/** Sign in by email OTP and return the fresh session's row id and the member's user id. */
async function signInSession(email: string): Promise<{ sessionId: string; userId: string }> {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  expect(res.status).toBe(200)
  const cookie = res.headers.get('set-cookie') ?? ''
  const s = await auth.api.getSession({
    headers: new Headers({ cookie }),
    query: { disableCookieCache: true },
  })
  return { sessionId: s?.session.id as string, userId: s?.user.id as string }
}

async function readReauth(sessionId: string): Promise<Date | null> {
  const [r] = await app
    .select({ at: authSchema.session.reauthenticatedAt })
    .from(authSchema.session)
    .where(eq(authSchema.session.id, sessionId))
  return r?.at ?? null
}

/** Register a merchant passkey the way Better Auth stores it: standard base64 key, CSV transports. */
async function insertPasskey(userId: string, credentialId: string, pk: number[]): Promise<void> {
  await owner.insert(authSchema.passkey).values({
    id: `pk-${credentialId}`,
    name: 'Test key',
    publicKey: Buffer.from(pk).toString('base64'),
    userId,
    credentialID: credentialId,
    counter: 0,
    deviceType: 'multiDevice',
    backedUp: true,
    transports: 'internal',
  })
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
  verifyCalls.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('markReauthenticated', () => {
  it('stamps only its own session row, scoped by id and user', async () => {
    const a = await signInSession('owner@example.com')
    const when = new Date(Date.now() + 60_000)
    expect(await stepUp.markReauthenticated(app, { sessionId: a.sessionId, userId: a.userId }, when)).toBe(true)
    expect(Math.abs((await readReauth(a.sessionId))!.getTime() - when.getTime())).toBeLessThan(1000)

    // A mismatched user can never bump someone else's session row.
    const before = (await readReauth(a.sessionId))!.getTime()
    expect(
      await stepUp.markReauthenticated(app, { sessionId: a.sessionId, userId: 'not-the-owner' }),
    ).toBe(false)
    expect((await readReauth(a.sessionId))!.getTime()).toBe(before)
  })
})

describe('OTP step-up', () => {
  it('verifies the right code and stamps the session; no new session is minted', async () => {
    const a = await signInSession('owner@example.com')
    const otp = await stepUp.createStepUpOtp(app, a.userId)
    expect(otp).toMatch(/^\d{6}$/)

    const when = new Date(Date.now() + 120_000)
    expect(
      await stepUp.verifyStepUpOtp(app, { sessionId: a.sessionId, userId: a.userId, otp }, when),
    ).toEqual({ ok: true })
    expect(Math.abs((await readReauth(a.sessionId))!.getTime() - when.getTime())).toBeLessThan(1000)

    // A consumed code cannot be replayed.
    expect(
      await stepUp.verifyStepUpOtp(app, { sessionId: a.sessionId, userId: a.userId, otp }),
    ).toEqual({ ok: false, reason: 'invalid' })
  })

  it('rejects a wrong code and leaves the session un-stamped', async () => {
    const a = await signInSession('owner@example.com')
    const otp = await stepUp.createStepUpOtp(app, a.userId)
    const before = (await readReauth(a.sessionId))!.getTime()
    const wrong = otp === '000000' ? '111111' : '000000'
    expect(
      await stepUp.verifyStepUpOtp(app, { sessionId: a.sessionId, userId: a.userId, otp: wrong }),
    ).toEqual({ ok: false, reason: 'invalid' })
    expect((await readReauth(a.sessionId))!.getTime()).toBe(before)

    // A few more wrong guesses and the code is burned; even the right one no longer works.
    for (let i = 0; i < 4; i++) {
      await stepUp.verifyStepUpOtp(app, { sessionId: a.sessionId, userId: a.userId, otp: wrong })
    }
    expect(
      await stepUp.verifyStepUpOtp(app, { sessionId: a.sessionId, userId: a.userId, otp }),
    ).toEqual({ ok: false, reason: 'invalid' })
    expect((await readReauth(a.sessionId))!.getTime()).toBe(before)
  })
})

describe('passkey step-up', () => {
  it('reports whether a member has a passkey enrolled', async () => {
    const a = await signInSession('owner@example.com')
    expect(await stepUp.hasPasskey(app, a.userId)).toBe(false)
    await insertPasskey(a.userId, 'cred-1', [9, 9, 9])
    expect(await stepUp.hasPasskey(app, a.userId)).toBe(true)
  })

  it('keeps the challenge server-side, verifies once, and stamps the session', async () => {
    const a = await signInSession('owner@example.com')
    await insertPasskey(a.userId, 'cred-1', [9, 9, 9])

    const { options } = await stepUp.stepUpPasskeyOptions(app, {
      sessionId: a.sessionId,
      userId: a.userId,
      rpId: RP.rpId,
    })
    expect(options.userVerification).toBe('required')
    expect(options.allowCredentials?.map((c) => c.id)).toContain('cred-1')

    const when = new Date(Date.now() + 30_000)
    expect(
      await stepUp.verifyStepUpPasskey(
        app,
        { sessionId: a.sessionId, userId: a.userId, ...RP, response: ANSWER },
        when,
      ),
    ).toEqual({ ok: true })
    expect(verifyCalls.at(-1)).toMatchObject({
      expectedChallenge: options.challenge,
      expectedRPID: RP.rpId,
      requireUserVerification: true,
    })
    expect(Math.abs((await readReauth(a.sessionId))!.getTime() - when.getTime())).toBeLessThan(1000)

    // The same challenge cannot be answered twice.
    expect(
      await stepUp.verifyStepUpPasskey(app, {
        sessionId: a.sessionId,
        userId: a.userId,
        ...RP,
        response: ANSWER,
      }),
    ).toEqual({ ok: false, reason: 'invalid' })
  })

  it('refuses an expired challenge and one answered for another rpID', async () => {
    const a = await signInSession('owner@example.com')
    await insertPasskey(a.userId, 'cred-1', [9, 9, 9])

    await stepUp.stepUpPasskeyOptions(app, { sessionId: a.sessionId, userId: a.userId, rpId: RP.rpId })
    const late = new Date(Date.now() + 5 * 60_000 + 1)
    expect(
      await stepUp.verifyStepUpPasskey(
        app,
        { sessionId: a.sessionId, userId: a.userId, ...RP, response: ANSWER },
        late,
      ),
    ).toEqual({ ok: false, reason: 'invalid' })

    await stepUp.stepUpPasskeyOptions(app, { sessionId: a.sessionId, userId: a.userId, rpId: RP.rpId })
    expect(
      await stepUp.verifyStepUpPasskey(app, {
        sessionId: a.sessionId,
        userId: a.userId,
        rpId: 'evil.in',
        origin: 'https://evil.in',
        response: ANSWER,
      }),
    ).toEqual({ ok: false, reason: 'invalid' })

    // The stub was never reached: our own challenge checks rejected both first.
    expect(verifyCalls).toHaveLength(0)
  })
})

describe('freshness window', () => {
  it('is fresh within 10 minutes of the last step-up and stale after', async () => {
    const a = await signInSession('owner@example.com')
    const t0 = new Date()
    await stepUp.markReauthenticated(app, { sessionId: a.sessionId, userId: a.userId }, t0)

    const atFive = await stepUp.stepUpAgeMs(app, a.sessionId, new Date(t0.getTime() + 5 * 60_000))
    expect(stepUp.isFresh(atFive)).toBe(true)

    const atEleven = await stepUp.stepUpAgeMs(app, a.sessionId, new Date(t0.getTime() + 10 * 60_000 + 1))
    expect(stepUp.isFresh(atEleven)).toBe(false)

    expect(await stepUp.stepUpAgeMs(app, 'no-such-session')).toBeNull()
    expect(stepUp.isFresh(null)).toBe(false)
  })
})
