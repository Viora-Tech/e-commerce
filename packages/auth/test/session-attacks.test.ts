import { createDb } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createMerchantAuth } from '../src/merchant'

/**
 * Owner-authorized attack simulation (docs/security/2026-10-30-app-attack-catalog.md, class A).
 * Each test drives one session/authn attack against the real merchant auth and asserts what
 * the admin does TODAY. A test tagged CONTROL proves a defence holds; one tagged KNOWN-GAP
 * pins down a hole so a later fix can flip the assertion.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const sent: { email: string; otp: string; type: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})

/** Sign in by email OTP and return the raw `cookie` header a browser would then send. */
async function signIn(email: string): Promise<string> {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  expect(res.status).toBe(200)
  return res.headers.get('set-cookie') ?? ''
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('A1 — session cookie replay (cookie cloning)', () => {
  it('KNOWN-GAP: a cloned cookie authenticates from a different client', async () => {
    const cookie = await signIn('owner@example.com')

    // The attacker copies the cookie out of the victim's browser profile and replays it from
    // a completely separate client (new Headers = new device, new TLS, different IP).
    const asAttacker = await auth.api.getSession({ headers: new Headers({ cookie }) })

    // Today this SUCCEEDS: the session is bearer-only, not bound to device/IP/UA.
    expect(asAttacker?.user.email).toBe('owner@example.com')
    // When device/session binding lands, flip this to expect(asAttacker).toBeNull().
  })
})

describe('A2 — replay from a new IP/country', () => {
  it('KNOWN-GAP: sessions store no IP, so cross-geo reuse cannot be detected', async () => {
    const cookie = await signIn('owner@example.com')
    const sessions = await auth.api.listSessions({ headers: new Headers({ cookie }) })
    expect(sessions.length).toBeGreaterThan(0)
    // trustedProxy defaults to 'none' (audit D-01: never trust a client-sent IP header), so
    // ipAddress is empty and no "same session, new country" rule is possible server-side today.
    for (const s of sessions) expect(s.ipAddress ?? '').toBe('')
  })
})

describe('A3 — reuse after sign-out / revocation', () => {
  it('CONTROL: signing out invalidates the cookie on the server', async () => {
    const cookie = await signIn('owner@example.com')
    const headers = new Headers({ cookie })
    await auth.api.signOut({ headers })

    // Re-check with the old cookie, bypassing the 5-min cookie cache to read true state.
    const after = await auth.api.getSession({
      headers: new Headers({ cookie }),
      query: { disableCookieCache: true },
    })
    expect(after).toBeNull()
  })

  it('CONTROL: an owner can revoke another device, killing its session', async () => {
    const device1 = new Headers({ cookie: await signIn('owner@example.com') })
    const device2cookie = await signIn('owner@example.com')
    const device2 = new Headers({ cookie: device2cookie })

    const sessions = await auth.api.listSessions({ headers: device1 })
    expect(sessions.length).toBeGreaterThanOrEqual(2)
    // Revoke every other session from device 1 (the "sign out all other devices" button).
    await auth.api.revokeOtherSessions({ headers: device1 })

    const device2after = await auth.api.getSession({
      headers: device2,
      query: { disableCookieCache: true },
    })
    expect(device2after).toBeNull()
  })
})

describe('A4 — session fixation', () => {
  it('CONTROL: a pre-planted cookie is not adopted; login mints a fresh token', async () => {
    const planted = 'better-auth.session_token=attacker-fixed-token-value; Path=/'
    await auth.api.sendVerificationOTP({ body: { email: 'owner@example.com', type: 'sign-in' } })
    const res = await auth.api.signInEmailOTP({
      body: { email: 'owner@example.com', otp: sent.at(-1)?.otp as string },
      asResponse: true,
      headers: new Headers({ cookie: planted }),
    })
    const issued = res.headers.get('set-cookie') ?? ''
    expect(res.status).toBe(200)
    // The server ignores the planted value and issues its own token.
    expect(issued).toContain('better-auth.session_token=')
    expect(issued).not.toContain('attacker-fixed-token-value')
    // The planted token never becomes a real session.
    const asPlanted = await auth.api.getSession({
      headers: new Headers({ cookie: planted }),
      query: { disableCookieCache: true },
    })
    expect(asPlanted).toBeNull()
  })
})

describe('A6 — OTP brute force', () => {
  it('reports whether wrong-code attempts are capped before the real code', async () => {
    await auth.api.sendVerificationOTP({ body: { email: 'owner@example.com', type: 'sign-in' } })
    const realOtp = sent.at(-1)?.otp as string

    let rejectedWrong = 0
    for (let i = 0; i < 5; i++) {
      const res = await auth.api.signInEmailOTP({
        body: { email: 'owner@example.com', otp: '000000' },
        asResponse: true,
      })
      if (res.status >= 400) rejectedWrong++
    }
    expect(rejectedWrong).toBe(5) // every wrong guess is rejected

    // After the burst of wrong guesses, is the genuine code still accepted?
    const real = await auth.api.signInEmailOTP({
      body: { email: 'owner@example.com', otp: realOtp },
      asResponse: true,
    })
    // CONTROL if the code is now dead (attempts exhausted / invalidated): status >= 400.
    // KNOWN-GAP if it still returns 200 (unlimited guesses against a 6-digit code).
    expect(real.status).toBeGreaterThanOrEqual(400)
  })
})

describe('A7 — OTP single-use', () => {
  it('CONTROL: a consumed OTP cannot be replayed', async () => {
    await auth.api.sendVerificationOTP({ body: { email: 'owner@example.com', type: 'sign-in' } })
    const otp = sent.at(-1)?.otp as string

    const first = await auth.api.signInEmailOTP({
      body: { email: 'owner@example.com', otp },
      asResponse: true,
    })
    expect(first.status).toBe(200)

    const replay = await auth.api.signInEmailOTP({
      body: { email: 'owner@example.com', otp },
      asResponse: true,
    })
    expect(replay.status).toBeGreaterThanOrEqual(400)
  })
})
