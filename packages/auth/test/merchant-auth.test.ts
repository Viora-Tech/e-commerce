import { createDb } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createMerchantAuth } from '../src/merchant'

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

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('merchant auth', () => {
  it('signs a new user in with an email OTP and creates a session', async () => {
    await auth.api.sendVerificationOTP({ body: { email: 'kuldeep@example.com', type: 'sign-in' } })
    expect(sent).toHaveLength(1)
    const otp = sent[0]?.otp as string
    expect(otp).toMatch(/^\d{6}$/)

    const res = await auth.api.signInEmailOTP({
      body: { email: 'kuldeep@example.com', otp },
      asResponse: true,
    })
    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('better-auth.session_token')

    const session = await auth.api.getSession({ headers: new Headers({ cookie }) })
    expect(session?.user.email).toBe('kuldeep@example.com')
  })

  it('rejects a wrong code', async () => {
    await auth.api.sendVerificationOTP({ body: { email: 'kuldeep@example.com', type: 'sign-in' } })
    const res = await auth.api.signInEmailOTP({
      body: { email: 'kuldeep@example.com', otp: '000000' },
      asResponse: true,
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('lets a signed-in user create an organization and become its owner', async () => {
    await auth.api.sendVerificationOTP({ body: { email: 'k@example.com', type: 'sign-in' } })
    const res = await auth.api.signInEmailOTP({
      body: { email: 'k@example.com', otp: sent[0]?.otp as string },
      asResponse: true,
    })
    const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
    const org = await auth.api.createOrganization({
      headers,
      body: { name: 'Waimers', slug: 'waimers' },
    })
    expect(org?.slug).toBe('waimers')
    const full = await auth.api.getFullOrganization({
      headers,
      query: { organizationId: org?.id as string },
    })
    expect(full?.members[0]?.role).toBe('owner')
  })
})
