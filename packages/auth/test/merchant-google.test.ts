/**
 * "Continue with Google" for merchants, end to end through Better Auth's HTTP handler: the
 * sign-in start, Google's token endpoint (faked), the callback, linking and the sign-in log.
 */
import { authSchema, createDb } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMerchantAuth, type SignInEvent, validateMerchantUserInfo } from '../src/merchant'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const ADMIN = 'http://localhost:3200'
const sent: { email: string; otp: string; type: string }[] = []
const signIns: SignInEvent[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: ADMIN,
  secret: 'test-secret-test-secret-test-secret-1234',
  trustedOrigins: [ADMIN],
  google: { clientId: 'test-client.apps.googleusercontent.com', clientSecret: 'test-secret' },
  sendOtp: async (m) => {
    sent.push(m)
  },
  onSignIn: async (e) => {
    signIns.push(e)
  },
})

type GoogleClaims = {
  sub: string
  email: string
  email_verified: boolean
  name?: string
  picture?: string
}

/** An id token as Google's token endpoint returns it; Better Auth only decodes it there. */
function idToken(claims: GoogleClaims): string {
  const part = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  return [
    part({ alg: 'RS256', kid: 'test', typ: 'JWT' }),
    part({
      iss: 'https://accounts.google.com',
      aud: 'test-client.apps.googleusercontent.com',
      iat: now,
      exp: now + 3600,
      ...claims,
    }),
    'signature',
  ].join('.')
}

/** Answers Google's token endpoint with these claims; every other request is refused. */
function fakeGoogle(claims: GoogleClaims) {
  const realFetch = globalThis.fetch
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return Response.json({
        access_token: 'google-access-token',
        id_token: idToken(claims),
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid email profile',
      })
    }
    if (url.startsWith('https://')) throw new Error(`unexpected fetch ${url}`)
    return realFetch(input, init)
  })
}

/** Every `set-cookie` folded into one `cookie` header (name=value pairs only). */
function cookiesFrom(res: Response, previous = ''): string {
  const jar = new Map<string, string>()
  for (const pair of previous.split('; ').filter(Boolean)) {
    const [name, ...rest] = pair.split('=')
    jar.set(name as string, rest.join('='))
  }
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(';')
    const [name, ...rest] = (pair as string).split('=')
    jar.set(name as string, rest.join('='))
  }
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
}

async function startGoogle(body: Record<string, unknown> = { callbackURL: '/' }) {
  return auth.handler(
    new Request(`${ADMIN}/api/auth/sign-in/social`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ADMIN },
      body: JSON.stringify({ provider: 'google', ...body }),
    }),
  )
}

/** Runs the whole redirect flow as a browser would; returns the callback's redirect. */
async function signInWithGoogle(claims: GoogleClaims, body?: Record<string, unknown>) {
  const start = await startGoogle(body)
  expect(start.status).toBe(200)
  const { url } = (await start.json()) as { url: string }
  const state = new URL(url).searchParams.get('state') as string
  const cookie = cookiesFrom(start)
  const google = fakeGoogle(claims)
  try {
    const res = await auth.handler(
      new Request(`${ADMIN}/api/auth/callback/google?code=good-code&state=${state}`, {
        headers: { cookie },
      }),
    )
    return { res, location: res.headers.get('location') ?? '', cookie: cookiesFrom(res, cookie) }
  } finally {
    google.mockRestore()
  }
}

async function signInWithOtp(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const otp = sent.at(-1)?.otp as string
  return auth.api.signInEmailOTP({ body: { email, otp } })
}

const usersWith = (email: string) =>
  owner.select().from(authSchema.user).where(eq(authSchema.user.email, email))
const accountsOf = (userId: string) =>
  owner.select().from(authSchema.account).where(eq(authSchema.account.userId, userId))

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
  signIns.length = 0
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('merchant Google sign-in', () => {
  it('sends Google the admin callback, PKCE and the account chooser', async () => {
    const res = await startGoogle()
    const { url } = (await res.json()) as { url: string }
    const google = new URL(url)
    expect(google.origin).toBe('https://accounts.google.com')
    expect(google.searchParams.get('redirect_uri')).toBe(`${ADMIN}/api/auth/callback/google`)
    expect(google.searchParams.get('code_challenge_method')).toBe('S256')
    expect(google.searchParams.get('prompt')).toBe('select_account')
    expect(google.searchParams.get('state')).toBeTruthy()
  })

  it('creates a new member with a verified email, like an email-code sign-up', async () => {
    const { location, cookie } = await signInWithGoogle(
      {
        sub: 'google-1',
        email: 'Asha@Example.com',
        email_verified: true,
        name: 'Asha',
        picture: 'https://lh3.googleusercontent.com/a/photo',
      },
      { callbackURL: '/' },
    )
    expect(location).toBe('/')
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) })
    expect(session?.user.email).toBe('asha@example.com')
    expect(session?.user.emailVerified).toBe(true)
    expect(session?.user.name).toBe('Asha')
    // Photos only come from Account → Profile, never Google's URL.
    expect(session?.user.image ?? null).toBeNull()
    const [account] = await accountsOf(session?.user.id as string)
    expect(account?.providerId).toBe('google')
    expect(account?.accountId).toBe('google-1')
    // Tokens are stored encrypted, never as Google sent them.
    expect(account?.accessToken).not.toBe('google-access-token')
  })

  it('records the sign-in through the callback path', async () => {
    await signInWithGoogle({ sub: 'google-1', email: 'asha@example.com', email_verified: true })
    expect(signIns).toHaveLength(1)
    expect(signIns[0]?.path).toBe('/callback/google')
  })

  it('signs an existing member into their own account, with no second user', async () => {
    const existing = await signInWithOtp('owner@example.com')
    const { cookie } = await signInWithGoogle({
      sub: 'google-owner',
      email: 'owner@example.com',
      email_verified: true,
    })
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) })
    expect(session?.user.id).toBe(existing.user.id)
    expect(await usersWith('owner@example.com')).toHaveLength(1)
    const accounts = await accountsOf(existing.user.id)
    expect(accounts.map((a) => a.providerId)).toContain('google')

    // The next time, the Google account itself finds them.
    const again = await signInWithGoogle({
      sub: 'google-owner',
      email: 'owner@example.com',
      email_verified: true,
    })
    const second = await auth.api.getSession({ headers: new Headers({ cookie: again.cookie }) })
    expect(second?.user.id).toBe(existing.user.id)
  })

  it('refuses a Google address Google has not verified, and links nothing', async () => {
    const existing = await signInWithOtp('owner@example.com')
    const { location } = await signInWithGoogle({
      sub: 'attacker',
      email: 'owner@example.com',
      email_verified: false,
    })
    // Better Auth's own linking rule answers first here; validateMerchantUserInfo backs it up.
    expect(location).toMatch(/error=(account_not_linked|email_not_verified)/)
    const accounts = await accountsOf(existing.user.id)
    expect(accounts.some((a) => a.providerId === 'google')).toBe(false)
    expect(signIns).toHaveLength(1) // only the email-code sign-in
  })

  it('creates no member for an unverified Google address and says why on the login page', async () => {
    const { location } = await signInWithGoogle(
      { sub: 'google-2', email: 'new@example.com', email_verified: false },
      { callbackURL: '/', errorCallbackURL: '/login' },
    )
    expect(location).toMatch(/^\/login\?error=email_not_verified/)
    expect(await usersWith('new@example.com')).toHaveLength(0)
  })

  it('never links to a member whose own email is not verified', async () => {
    await owner.insert(authSchema.user).values({
      id: 'unverified-user',
      name: 'Squatter',
      email: 'victim@example.com',
      emailVerified: false,
    })
    const { location } = await signInWithGoogle({
      sub: 'victim-google',
      email: 'victim@example.com',
      email_verified: true,
    })
    expect(location).toContain('error=account_not_linked')
    expect(await accountsOf('unverified-user')).toHaveLength(0)
  })

  it('a Google account linked to one member never opens another', async () => {
    const asha = await signInWithOtp('asha@example.com')
    await signInWithOtp('ravi@example.com')
    await signInWithGoogle({ sub: 'asha-google', email: 'asha@example.com', email_verified: true })
    // Google later reports Ravi's address for Asha's Google account: still Asha.
    const { cookie } = await signInWithGoogle({
      sub: 'asha-google',
      email: 'ravi@example.com',
      email_verified: true,
    })
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) })
    expect(session?.user.id).toBe(asha.user.id)
  })

  it('refuses a callback URL on another site (no open redirect)', async () => {
    for (const callbackURL of [
      'https://evil.example/steal',
      '//evil.example/steal',
      '/\\evil.example',
    ]) {
      const res = await startGoogle({ callbackURL })
      expect(res.status, callbackURL).toBe(403)
    }
    expect((await startGoogle({ errorCallbackURL: 'https://evil.example' })).status).toBe(403)
    expect((await startGoogle({ newUserCallbackURL: 'https://evil.example' })).status).toBe(403)
  })

  it('refuses a callback whose state cookie belongs to another browser', async () => {
    const start = await startGoogle()
    const { url } = (await start.json()) as { url: string }
    const state = new URL(url).searchParams.get('state') as string
    const google = fakeGoogle({ sub: 'g', email: 'x@example.com', email_verified: true })
    const res = await auth.handler(
      new Request(`${ADMIN}/api/auth/callback/google?code=good-code&state=${state}`),
    )
    google.mockRestore()
    expect(res.headers.get('location')).toContain('error=')
    expect(await usersWith('x@example.com')).toHaveLength(0)
  })

  // Without cookies Better Auth lets the start through: harmless, the state it makes only
  // completes in the browser holding its signed cookie (test above).
  it('refuses a sign-in started from another origin with the browser cookies', async () => {
    const res = await auth.handler(
      new Request(`${ADMIN}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://evil.example',
          cookie: 'better-auth.session_token=x',
        },
        body: JSON.stringify({ provider: 'google', callbackURL: '/' }),
      }),
    )
    expect(res.status).toBe(403)
  })

  it('does not take an id token directly (One Tap is off)', async () => {
    const res = await startGoogle({
      idToken: {
        token: idToken({ sub: 'g', email: 'x@example.com', email_verified: true }),
      },
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(await usersWith('x@example.com')).toHaveLength(0)
  })
})

describe('Google sign-in switched off', () => {
  const off = createMerchantAuth({
    db: app,
    baseURL: ADMIN,
    secret: 'test-secret-test-secret-test-secret-1234',
    sendOtp: async () => {},
  })

  it('answers not found for the provider', async () => {
    const res = await off.handler(
      new Request(`${ADMIN}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ADMIN },
        body: JSON.stringify({ provider: 'google', callbackURL: '/' }),
      }),
    )
    expect(res.status).toBe(404)
  })
})

describe('validateMerchantUserInfo', () => {
  const google = (emailVerified: unknown, claim: unknown) => ({
    user: { emailVerified },
    source: {
      method: 'oauth',
      oauth: { providerId: 'google', profile: { email_verified: claim } },
    },
  })

  it('passes only a Google address verified by both the claim and the mapped flag', () => {
    expect(validateMerchantUserInfo(google(true, true))).toBeUndefined()
    expect(validateMerchantUserInfo(google(true, 'true'))?.error).toBe('email_not_verified')
    expect(validateMerchantUserInfo(google(false, true))?.error).toBe('email_not_verified')
    expect(validateMerchantUserInfo(google(true, undefined))?.error).toBe('email_not_verified')
  })

  it('refuses any other OAuth provider and leaves email codes alone', () => {
    expect(
      validateMerchantUserInfo({
        user: { emailVerified: true },
        source: { method: 'oauth', oauth: { providerId: 'github' } },
      })?.error,
    ).toBe('provider_not_allowed')
    expect(
      validateMerchantUserInfo({ user: { emailVerified: false }, source: { method: 'email-otp' } }),
    ).toBeUndefined()
  })
})
