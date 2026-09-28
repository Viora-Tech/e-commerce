/** SOURCE OF TRUTH: shopper login pure rule tests — hand-off token checks (tampered, expired, wrong store, foreign return URL), the return URL allow-list, the identity linking rule (verified vs unverified email), which sign-in options the storefront shows, session lifetime, provider profile mapping and Apple's client secret */
import { generateKeyPairSync } from 'node:crypto'
import { decodeJwt, decodeProtectedHeader } from 'jose'
import { describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import {
  CustomerAccountSettingsSchema,
  type ProviderReadiness,
  providersNeedingSetup,
  sessionLifetime,
  signInOptions,
} from '../customer-accounts/client'
import { appFor, loginAppFrom, loginReadiness, platformLoginApps } from './credentials'
import { decideLink, type ShopperIdentity } from './identities'
import { appleClientSecret, identityFromUserInfo } from './providers'
import {
  checkHandoffToken,
  checkReturnUrl,
  type HandoffPayload,
  openToken,
  safeNextPath,
  signToken,
} from './tokens'
import {
  completeTruecaller,
  isTruecallerEndpoint,
  mobileFromProfile,
  storeFromTruecallerNonce,
  truecallerDeepLink,
  truecallerNonce,
} from './truecaller'

const SECRET = 'test-only-settings-secret-value'
const NOW = new Date('2026-09-28T10:00:00Z')
const STORE = '01923456-7890-7abc-8def-0123456789ab'
const OTHER_STORE = '01923456-7890-7abc-8def-ba9876543210'
const RETURN = 'https://shop.example.in/account/login/complete'

const handoff = (over: Partial<HandoffPayload> = {}) =>
  signToken<HandoffPayload>(
    { v: 1, s: STORE, r: RETURN, j: 'a'.repeat(43), e: NOW.getTime() + 60_000, ...over },
    SECRET,
    'handoff',
  )

const expect1 = { secret: SECRET, storeId: STORE, returnUrl: RETURN, now: NOW }

describe('hand-off token', () => {
  it('accepts a fresh token for this store and URL', () => {
    expect(checkHandoffToken(handoff(), expect1)).toEqual({ ok: true, jti: 'a'.repeat(43) })
  })

  it('rejects a tampered token: changed payload or signature', () => {
    const [body, sig] = handoff().split('.') as [string, string]
    const forged = Buffer.from(
      JSON.stringify({ v: 1, s: STORE, r: RETURN, j: 'b'.repeat(43), e: NOW.getTime() + 60_000 }),
    ).toString('base64url')
    expect(checkHandoffToken(`${forged}.${sig}`, expect1)).toEqual({
      ok: false,
      reason: 'tampered',
    })
    const flipped = `${sig.slice(0, -1)}${sig.endsWith('A') ? 'B' : 'A'}`
    expect(checkHandoffToken(`${body}.${flipped}`, expect1)).toEqual({
      ok: false,
      reason: 'tampered',
    })
    expect(checkHandoffToken(handoff(), { ...expect1, secret: 'another-secret-value' })).toEqual({
      ok: false,
      reason: 'tampered',
    })
  })

  it('rejects a token signed for another purpose', () => {
    const passkey = signToken(
      { v: 1, s: STORE, r: RETURN, j: 'a'.repeat(43), e: NOW.getTime() + 60_000 },
      SECRET,
      'passkey',
    )
    expect(checkHandoffToken(passkey, expect1)).toMatchObject({ ok: false, reason: 'tampered' })
  })

  it('rejects an expired token', () => {
    expect(checkHandoffToken(handoff({ e: NOW.getTime() }), expect1)).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('rejects a token for another store', () => {
    expect(checkHandoffToken(handoff({ s: OTHER_STORE }), expect1)).toEqual({
      ok: false,
      reason: 'wrong_store',
    })
  })

  it('rejects a token for another return URL', () => {
    const r = 'https://evil.example.com/account/login/complete'
    expect(checkHandoffToken(handoff({ r }), expect1)).toEqual({
      ok: false,
      reason: 'wrong_return',
    })
  })

  it('rejects garbage', () => {
    for (const t of [undefined, '', 'abc', 'a.b.c', 'x'.repeat(5000), 42]) {
      expect(checkHandoffToken(t, expect1)).toMatchObject({ ok: false, reason: 'malformed' })
    }
    const notJson = `${Buffer.from('nope').toString('base64url')}`
    expect(openToken(`${notJson}.sig`, SECRET, 'handoff', NOW)).toMatchObject({ ok: false })
  })
})

describe('return URL allow-list', () => {
  const hosts = ['shop.example.in', 'waimers.waimers.store']

  it('allows only the completion path on the store’s own domains', () => {
    expect(checkReturnUrl(RETURN, hosts, { dev: false })).toBe(RETURN)
    expect(
      checkReturnUrl('https://WAIMERS.waimers.store/account/login/complete', hosts, { dev: false }),
    ).toBe('https://waimers.waimers.store/account/login/complete')
  })

  it('refuses foreign hosts, lookalikes, other paths and tricks', () => {
    for (const url of [
      'https://evil.example.com/account/login/complete',
      'https://shop.example.in.evil.com/account/login/complete',
      'https://evil.com@shop.example.in/account/login/complete',
      'https://shop.example.in:8443/account/login/complete',
      'https://shop.example.in/account/orders',
      'https://shop.example.in/account/login/complete?next=//evil.com',
      'https://shop.example.in/account/login/complete#x',
      'http://shop.example.in/account/login/complete',
      'javascript:alert(1)',
      '/account/login/complete',
      'not a url',
      null,
    ]) {
      expect(checkReturnUrl(url, hosts, { dev: false }), String(url)).toBeNull()
    }
  })

  it('allows http and a port in development only', () => {
    const dev = 'http://shop.example.in:3100/account/login/complete'
    expect(checkReturnUrl(dev, hosts, { dev: true })).toBe(dev)
    expect(checkReturnUrl(dev, hosts, { dev: false })).toBeNull()
  })

  it('keeps next paths same-site', () => {
    expect(safeNextPath('/account/orders')).toBe('/account/orders')
    for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', '/a\nb', 7]) {
      expect(safeNextPath(bad)).toBe('/account')
    }
  })
})

const identity = (over: Partial<ShopperIdentity> = {}): ShopperIdentity => ({
  provider: 'google',
  subject: 'g-123',
  email: 'asha@example.com',
  emailVerified: true,
  name: 'Asha',
  ...over,
})
const none = { byIdentity: null, byEmail: null, byPhone: null, linkTo: null }

describe('linking rule', () => {
  it('signs in the customer an identity is already linked to', () => {
    expect(decideLink(identity(), { ...none, byIdentity: 'c1', byEmail: 'c2' })).toEqual({
      action: 'sign_in',
      customerId: 'c1',
    })
  })

  it('links a verified email to the existing customer, else creates one', () => {
    expect(decideLink(identity(), { ...none, byEmail: 'c2' })).toEqual({
      action: 'link',
      customerId: 'c2',
    })
    expect(decideLink(identity(), none)).toEqual({ action: 'create' })
  })

  it('never links or creates on an unverified email', () => {
    const fb = identity({ provider: 'facebook', emailVerified: false })
    expect(decideLink(fb, { ...none, byEmail: 'c2' })).toEqual({
      action: 'verify_email',
      email: 'asha@example.com',
    })
    expect(decideLink(fb, none)).toEqual({ action: 'verify_email', email: 'asha@example.com' })
    expect(decideLink(identity({ email: null, emailVerified: false }), none)).toEqual({
      action: 'no_email',
    })
  })

  it('links a verified mobile (Truecaller) by phone', () => {
    const tc = identity({ provider: 'truecaller', subject: '9876543210', mobile: '9876543210' })
    expect(decideLink(tc, { ...none, byPhone: 'c3' })).toEqual({
      action: 'link',
      customerId: 'c3',
    })
    expect(decideLink(tc, none)).toEqual({ action: 'create' })
  })

  it('connects to the signed-in shopper, unless the identity is someone else’s', () => {
    expect(decideLink(identity(), { ...none, linkTo: 'me' })).toEqual({
      action: 'link',
      customerId: 'me',
    })
    expect(decideLink(identity(), { ...none, linkTo: 'me', byIdentity: 'other' })).toEqual({
      action: 'conflict',
    })
  })
})

const readiness = (over: Partial<ProviderReadiness> = {}): ProviderReadiness => ({
  google: { platform: true, own: false },
  apple: { platform: true, own: false },
  facebook: { platform: false, own: false },
  truecaller: { platform: false, own: false },
  ...over,
})

describe('sign-in options the storefront shows', () => {
  it('shows only codes by default', () => {
    const s = CustomerAccountSettingsSchema.parse({})
    expect(signInOptions(s, ['email'], readiness())).toEqual({
      codes: ['email'],
      social: [],
      oneTap: false,
      truecaller: false,
      magicLink: false,
      passkeys: false,
      rememberDevice: false,
    })
  })

  it('shows switched-on providers whose app is set up, in order', () => {
    const s = CustomerAccountSettingsSchema.parse({
      providers: {
        facebook: { enabled: true },
        apple: { enabled: true },
        google: { enabled: true },
        truecaller: { enabled: true, credentials: 'own' },
      },
    })
    const o = signInOptions(s, ['email', 'sms'], readiness())
    // Facebook has no app anywhere, Truecaller has no own app: neither shows.
    expect(o.social).toEqual(['google', 'apple'])
    expect(o.truecaller).toBe(false)
    expect(providersNeedingSetup(s, readiness())).toEqual(['facebook', 'truecaller'])
    const ready = signInOptions(
      s,
      ['email'],
      readiness({ truecaller: { platform: false, own: true } }),
    )
    expect(ready.truecaller).toBe(true)
  })

  it('offers One Tap only with the merchant’s own Google app', () => {
    const platform = CustomerAccountSettingsSchema.parse({
      providers: { google: { enabled: true } },
      googleOneTap: true,
    })
    expect(signInOptions(platform, ['email'], readiness()).oneTap).toBe(false)
    const own = CustomerAccountSettingsSchema.parse({
      providers: { google: { enabled: true, credentials: 'own' } },
      googleOneTap: true,
    })
    const r = readiness({ google: { platform: false, own: true } })
    expect(signInOptions(own, ['email'], r)).toMatchObject({ social: ['google'], oneTap: true })
  })

  it('offers a magic link only when email codes can be sent', () => {
    const s = CustomerAccountSettingsSchema.parse({
      loginMethods: ['email', 'sms'],
      magicLink: true,
      passkeys: true,
      rememberDevice: true,
    })
    expect(signInOptions(s, ['email', 'sms'], readiness())).toMatchObject({
      magicLink: true,
      passkeys: true,
      rememberDevice: true,
    })
    expect(signInOptions(s, ['sms'], readiness()).magicLink).toBe(false)
  })

  it('keeps old saved settings valid', () => {
    const s = CustomerAccountSettingsSchema.parse({ checkout: 'guest', loginMethods: ['sms'] })
    expect(s.providers.google).toEqual({ enabled: false, credentials: 'platform' })
    expect(s.magicLink).toBe(false)
  })
})

describe('session lifetime', () => {
  it('keeps 30 days when Remember this device is off', () => {
    expect(sessionLifetime(false, false)).toEqual({ ttlMs: 30 * 86_400_000, persistent: true })
  })
  it('remembers 90 days when ticked, until the browser closes when not', () => {
    expect(sessionLifetime(true, true)).toEqual({ ttlMs: 90 * 86_400_000, persistent: true })
    expect(sessionLifetime(true, false)).toEqual({ ttlMs: 43_200_000, persistent: false })
  })
})

describe('provider apps', () => {
  it('takes the platform apps from env only when complete', () => {
    const apps = platformLoginApps({
      SHOPPER_GOOGLE_CLIENT_ID: 'gid',
      SHOPPER_GOOGLE_CLIENT_SECRET: 'gsecret',
      SHOPPER_FACEBOOK_APP_ID: 'fb',
      SHOPPER_APPLE_PRIVATE_KEY: 'x\\ny',
    })
    expect(Object.keys(apps)).toEqual(['google'])
    const s = CustomerAccountSettingsSchema.parse({ providers: { google: { enabled: true } } })
    const own = { google: loginAppFrom('google', { clientId: 'm', clientSecret: 's' }) as never }
    expect(appFor(s, apps, own, 'google')?.clientId).toBe('gid')
    const mine = CustomerAccountSettingsSchema.parse({
      providers: { google: { enabled: true, credentials: 'own' } },
    })
    expect(appFor(mine, apps, own, 'google')?.clientId).toBe('m')
    expect(appFor(mine, apps, {}, 'google')).toBeNull()
    expect(loginReadiness(apps, own).google).toEqual({ platform: true, own: true })
    expect(loginAppFrom('google', { clientId: 'm' })).toBeNull()
  })

  it('maps profiles by provider id, never by email', () => {
    expect(
      identityFromUserInfo('google', {
        user: { email: 'a@b.in', emailVerified: true, name: ' Asha ' },
        data: { sub: 'g-1' },
      }),
    ).toEqual({
      provider: 'google',
      subject: 'g-1',
      email: 'a@b.in',
      emailVerified: true,
      name: 'Asha',
    })
    expect(
      identityFromUserInfo('facebook', {
        user: { email: 'a@b.in', emailVerified: false },
        data: { id: 12345 },
      }),
    ).toMatchObject({ subject: '12345', emailVerified: false, name: null })
    expect(identityFromUserInfo('google', { user: { emailVerified: true }, data: {} })).toBeNull()
    expect(identityFromUserInfo('google', null)).toBeNull()
  })

  it('signs Apple’s client secret with the .p8 key', async () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    const jwt = await appleClientSecret(
      {
        provider: 'apple',
        servicesId: 'in.shop.web',
        teamId: 'TEAM1',
        keyId: 'KEY1',
        privateKey: pem,
      },
      NOW,
    )
    expect(decodeProtectedHeader(jwt)).toMatchObject({ alg: 'ES256', kid: 'KEY1' })
    expect(decodeJwt(jwt)).toMatchObject({
      iss: 'TEAM1',
      sub: 'in.shop.web',
      aud: 'https://appleid.apple.com',
    })
  })
})

describe('Truecaller', () => {
  const random = Buffer.alloc(12, 7)

  it('signs the store into the request nonce', () => {
    const nonce = truecallerNonce(STORE, SECRET, random)
    expect(nonce).toHaveLength(59)
    expect(storeFromTruecallerNonce(nonce, SECRET)).toBe(STORE)
    expect(storeFromTruecallerNonce(nonce, 'another-secret-value')).toBeNull()
    const other = truecallerNonce(OTHER_STORE, SECRET, random)
    const spliced = `${other.slice(0, 20)}${nonce.slice(20)}`
    expect(storeFromTruecallerNonce(spliced, SECRET)).toBeNull()
  })

  it('builds the deep link', () => {
    const link = truecallerDeepLink({
      nonce: 'n'.repeat(59),
      partnerKey: 'pk',
      partnerName: 'Waimers',
      privacyUrl: 'https://shop.example.in/policies/privacy',
      termsUrl: 'https://shop.example.in/policies/terms',
    })
    expect(link.startsWith('truecallersdk://truecallersdk?type=btmsheet&')).toBe(true)
    expect(new URL(link).searchParams.get('partnerKey')).toBe('pk')
  })

  it('only fetches profiles from truecaller.com over https', () => {
    expect(isTruecallerEndpoint('https://profile4-noneu.truecaller.com/v1/default')).toBe(true)
    for (const bad of [
      'http://profile4-noneu.truecaller.com/v1/default',
      'https://truecaller.com.evil.in/x',
      'https://evil.in/?truecaller.com',
      'https://169.254.169.254/latest',
      'https://profile.truecaller.com:8443/x',
      42,
    ]) {
      expect(isTruecallerEndpoint(bad), String(bad)).toBe(false)
    }
  })

  it('reads the Indian mobile from the profile', () => {
    expect(mobileFromProfile({ phoneNumbers: [919876543210] })).toBe('9876543210')
    expect(mobileFromProfile({ phoneNumbers: ['12345'] })).toBeNull()
    expect(mobileFromProfile({})).toBeNull()
  })

  it('fetches the profile without following redirects, and fails on one', async () => {
    // Just enough of a transaction for the ticket lookup and the `failed` update.
    const updates: unknown[] = []
    const ticket = { id: 't1', status: 'pending', expiresAt: new Date(NOW.getTime() + 60_000) }
    const tx = {
      select: () => ({ from: () => ({ where: async () => [ticket] }) }),
      update: () => ({ set: (v: unknown) => ({ where: async () => updates.push(v) }) }),
    }
    const inits: RequestInit[] = []
    const done = await completeTruecaller(
      { tx, storeId: STORE } as unknown as StoreContext,
      {
        requestId: truecallerNonce(STORE, SECRET, random),
        accessToken: 'tok',
        endpoint: 'https://profile4-noneu.truecaller.com/v1/default',
      },
      {
        secret: SECRET,
        fetch: async (_url, init) => {
          inits.push(init)
          return new Response(null, {
            status: 302,
            headers: { location: 'http://169.254.169.254/' },
          })
        },
      },
      NOW,
    )
    expect(done).toBe('failed')
    expect(inits[0]?.redirect).toBe('error')
    expect(inits[0]?.signal).toBeInstanceOf(AbortSignal)
    expect(updates).toEqual([{ status: 'failed' }])
  })
})
