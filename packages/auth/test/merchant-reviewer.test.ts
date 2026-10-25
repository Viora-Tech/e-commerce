import { createDb } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createMerchantAuth } from '../src/merchant'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const REVIEWER = { email: 'reviewer@example.com', password: 'a-long-reviewer-password-123' }
const sent: { email: string; otp: string }[] = []

function makeAuth(reviewer: typeof REVIEWER | null) {
  return createMerchantAuth({
    db: app,
    baseURL: 'http://localhost:3200',
    secret: 'test-secret-test-secret-test-secret-1234',
    sendOtp: async (m) => {
      sent.push(m)
    },
    reviewer,
  })
}

const auth = makeAuth(REVIEWER)

/** The reviewer joins like any member first: an email code, once. */
async function createMember(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  await auth.api.signInEmailOTP({ body: { email, otp: sent.at(-1)?.otp as string } })
}

function signIn(a: ReturnType<typeof makeAuth>, body: Record<string, string>) {
  return a.handler(
    new Request('http://localhost:3200/api/auth/sign-in/reviewer-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3200' },
      body: JSON.stringify(body),
    }),
  )
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('reviewer password sign-in', () => {
  it('signs the configured member in with the configured password', async () => {
    await createMember(REVIEWER.email)
    const res = await signIn(auth, { email: 'Reviewer@Example.com', password: REVIEWER.password })
    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie') ?? ''
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) })
    expect(session?.user.email).toBe(REVIEWER.email)
  })

  it('refuses a wrong password', async () => {
    await createMember(REVIEWER.email)
    const res = await signIn(auth, { email: REVIEWER.email, password: 'wrong-password-wrong-123' })
    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie') ?? '').not.toContain('session_token')
  })

  it('refuses every other member, even with the right password', async () => {
    await createMember('merchant@example.com')
    const res = await signIn(auth, { email: 'merchant@example.com', password: REVIEWER.password })
    expect(res.status).toBe(401)
  })

  it('never creates the reviewer: they must already be a member', async () => {
    const res = await signIn(auth, REVIEWER)
    expect(res.status).toBe(401)
  })

  it('is not there at all when no reviewer is configured', async () => {
    await createMember(REVIEWER.email)
    const res = await signIn(makeAuth(null), REVIEWER)
    expect(res.status).toBe(404)
  })
})
