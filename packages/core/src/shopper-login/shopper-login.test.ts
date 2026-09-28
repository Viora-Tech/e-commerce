/** SOURCE OF TRUTH: shopper login database tests — single-use hand-off redemption (replayed, expired, wrong browser, wrong store, foreign return URL), account linking on verified vs unverified email, magic links, the Truecaller callback and pick-up, and merchant app credentials encrypted at rest */
import {
  createDb,
  customer,
  customerIdentity,
  customerLoginTicket,
  type StoreTx,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { verifyLoginCode } from '../accounts/auth'
import { decryptCustomerPhone } from '../customers/phone-crypto'
import { anonymiseCustomer } from '../privacy/anonymise'
import {
  LoginAppIncomplete,
  loadOwnLoginApps,
  maskedOwnLoginApps,
  removeOwnLoginApp,
  saveOwnLoginApp,
} from './credentials'
import { storeLoginHosts } from './domains'
import {
  linkIdentity,
  listCustomerIdentities,
  removeCustomerIdentity,
  resolveShopperIdentity,
  type ShopperIdentity,
} from './identities'
import { listCustomerPasskeys, passkeyLoginOptions, verifyPasskeyLogin } from './passkeys'
import {
  magicLinkIsLive,
  mintHandoff,
  redeemHandoff,
  redeemMagicLink,
  requestMagicLink,
} from './tickets'
import { sha256Hex } from './tokens'
import { completeTruecaller, pollTruecaller, startTruecaller } from './truecaller'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-only-settings-secret-value'
const NOW = new Date('2026-09-28T10:00:00Z')
const RETURN = 'https://shop.example.in/account/login/complete'
const BROWSER = 'browser-cookie-value-0123456789abcdef'

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

const run = <T>(storeId: string, fn: (ctx: { storeId: string; tx: StoreTx }) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

async function makeStore(slug = 'waimers'): Promise<string> {
  const [s] = await owner.insert(store).values({ slug, name: 'Waimers' }).returning()
  return s?.id as string
}

async function readyHandoff(storeId: string, customerId: string, at = NOW) {
  return run(storeId, (ctx) =>
    mintHandoff(
      ctx,
      {
        status: 'ready',
        customerId,
        returnUrl: RETURN,
        browserHash: sha256Hex(BROWSER),
        nextPath: '/account/orders',
        remember: true,
      },
      SECRET,
      at,
    ),
  )
}

async function makeCustomer(storeId: string, email: string | null = 'asha@example.com') {
  const [c] = await owner.insert(customer).values({ storeId, email }).returning()
  return c?.id as string
}

const redeem = (
  storeId: string,
  token: string,
  over: Partial<{ browserValue: string | null; returnUrl: string; now: Date }> = {},
) =>
  run(storeId, (ctx) =>
    redeemHandoff(ctx, token, {
      secret: SECRET,
      returnUrl: RETURN,
      browserValue: BROWSER,
      now: NOW,
      ...over,
    }),
  )

describe('hand-off redemption', () => {
  it('signs in once; a replay finds nothing', async () => {
    const storeId = await makeStore()
    const customerId = await makeCustomer(storeId)
    const token = await readyHandoff(storeId, customerId)
    expect(await redeem(storeId, token)).toEqual({
      ok: true,
      status: 'ready',
      customerId,
      nextPath: '/account/orders',
      remember: true,
    })
    expect(await redeem(storeId, token)).toEqual({ ok: false, reason: 'used' })
  })

  it('refuses an expired hand-off', async () => {
    const storeId = await makeStore()
    const token = await readyHandoff(storeId, await makeCustomer(storeId))
    expect(await redeem(storeId, token, { now: new Date(NOW.getTime() + 3 * 60_000) })).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('refuses another browser and burns the ticket', async () => {
    const storeId = await makeStore()
    const token = await readyHandoff(storeId, await makeCustomer(storeId))
    expect(await redeem(storeId, token, { browserValue: 'attacker-cookie' })).toEqual({
      ok: false,
      reason: 'wrong_browser',
    })
    expect(await redeem(storeId, token, { browserValue: null })).toEqual({
      ok: false,
      reason: 'used',
    })
  })

  it('refuses a hand-off minted for another store', async () => {
    const storeA = await makeStore('a')
    const storeB = await makeStore('b')
    const token = await readyHandoff(storeA, await makeCustomer(storeA))
    expect(await redeem(storeB, token)).toEqual({ ok: false, reason: 'wrong_store' })
    // Still usable on its own store: the refusal did not touch it.
    expect(await redeem(storeA, token)).toMatchObject({ ok: true })
  })

  it('refuses a foreign return URL', async () => {
    const storeId = await makeStore()
    const token = await readyHandoff(storeId, await makeCustomer(storeId))
    expect(
      await redeem(storeId, token, {
        returnUrl: 'https://evil.example.com/account/login/complete',
      }),
    ).toEqual({ ok: false, reason: 'wrong_return' })
  })

  it('refuses a tampered token without touching the ticket', async () => {
    const storeId = await makeStore()
    const token = await readyHandoff(storeId, await makeCustomer(storeId))
    expect(await redeem(storeId, `${token}x`)).toEqual({ ok: false, reason: 'tampered' })
    expect(await redeem(storeId, token)).toMatchObject({ ok: true })
  })

  it('carries a pending identity to confirm by email code', async () => {
    const storeId = await makeStore()
    const token = await run(storeId, (ctx) =>
      mintHandoff(
        ctx,
        {
          status: 'verify_email',
          customerId: null,
          identity: {
            provider: 'facebook',
            subject: 'fb-1',
            email: 'asha@example.com',
            emailVerified: false,
            name: 'Asha',
          },
          returnUrl: RETURN,
          browserHash: sha256Hex(BROWSER),
          nextPath: '/account',
          remember: false,
        },
        SECRET,
        NOW,
      ),
    )
    expect(await redeem(storeId, token)).toMatchObject({
      ok: true,
      status: 'verify_email',
      identity: { provider: 'facebook', subject: 'fb-1', email: 'asha@example.com' },
    })
  })
})

const google = (over: Partial<ShopperIdentity> = {}): ShopperIdentity => ({
  provider: 'google',
  subject: 'g-1',
  email: 'Asha@Example.com',
  emailVerified: true,
  name: 'Asha Rao',
  ...over,
})

describe('account linking', () => {
  it('links a verified email to the existing customer, no duplicate', async () => {
    const storeId = await makeStore()
    const existing = await makeCustomer(storeId, 'asha@example.com')
    const r = await run(storeId, (ctx) =>
      resolveShopperIdentity(ctx, google(), { secret: SECRET, now: NOW }),
    )
    expect(r).toEqual({ kind: 'signed_in', customerId: existing, created: false })
    const again = await run(storeId, (ctx) =>
      resolveShopperIdentity(ctx, google({ email: 'changed@example.com' }), {
        secret: SECRET,
        now: NOW,
      }),
    )
    // The provider id decides from now on, even if the Google email changes.
    expect(again).toEqual({ kind: 'signed_in', customerId: existing, created: false })
    const rows = await owner.select().from(customer).where(eq(customer.storeId, storeId))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('Asha Rao')
  })

  it('creates one customer for a new verified email', async () => {
    const storeId = await makeStore()
    const r = await run(storeId, (ctx) =>
      resolveShopperIdentity(ctx, google(), { secret: SECRET, now: NOW }),
    )
    expect(r).toMatchObject({ kind: 'signed_in', created: true })
    const [c] = await owner.select().from(customer).where(eq(customer.storeId, storeId))
    expect(c?.email).toBe('asha@example.com')
  })

  it('never links an unverified email to an existing customer', async () => {
    const storeId = await makeStore()
    await makeCustomer(storeId, 'asha@example.com')
    const fb = google({ provider: 'facebook', subject: 'fb-1', emailVerified: false })
    const r = await run(storeId, (ctx) =>
      resolveShopperIdentity(ctx, fb, { secret: SECRET, now: NOW }),
    )
    expect(r).toEqual({ kind: 'verify_email', email: 'asha@example.com' })
    expect(await owner.select().from(customerIdentity)).toHaveLength(0)
  })

  it('never creates a customer on an unverified email', async () => {
    const storeId = await makeStore()
    const fb = google({ provider: 'facebook', subject: 'fb-1', emailVerified: false })
    const r = await run(storeId, (ctx) =>
      resolveShopperIdentity(ctx, fb, { secret: SECRET, now: NOW }),
    )
    expect(r).toEqual({ kind: 'verify_email', email: 'asha@example.com' })
    expect(await owner.select().from(customer)).toHaveLength(0)
  })

  it('links the unverified identity after the shopper proves the email with a code', async () => {
    const storeId = await makeStore()
    const existing = await makeCustomer(storeId, 'asha@example.com')
    const fb = google({ provider: 'facebook', subject: 'fb-1', emailVerified: false })
    // What the storefront does after verifyLoginCode succeeds for the same email.
    await run(storeId, (ctx) => linkIdentity(ctx, existing, fb, NOW))
    const r = await run(storeId, (ctx) =>
      resolveShopperIdentity(ctx, fb, { secret: SECRET, now: NOW }),
    )
    expect(r).toEqual({ kind: 'signed_in', customerId: existing, created: false })
  })

  it('keeps identities per store', async () => {
    const storeA = await makeStore('a')
    const storeB = await makeStore('b')
    const a = await run(storeA, (ctx) =>
      resolveShopperIdentity(ctx, google(), { secret: SECRET, now: NOW }),
    )
    const b = await run(storeB, (ctx) =>
      resolveShopperIdentity(ctx, google(), { secret: SECRET, now: NOW }),
    )
    expect(a.kind === 'signed_in' && b.kind === 'signed_in' && a.customerId !== b.customerId).toBe(
      true,
    )
  })

  it('connects a provider to the signed-in shopper, lists and removes it', async () => {
    const storeId = await makeStore()
    const me = await makeCustomer(storeId, 'me@example.com')
    const fb = google({ provider: 'facebook', subject: 'fb-9', emailVerified: false })
    const r = await run(storeId, (ctx) =>
      resolveShopperIdentity(ctx, fb, { secret: SECRET, linkTo: me, now: NOW }),
    )
    expect(r).toEqual({ kind: 'signed_in', customerId: me, created: false })
    const other = await makeCustomer(storeId, 'other@example.com')
    const conflict = await run(storeId, (ctx) =>
      resolveShopperIdentity(ctx, fb, { secret: SECRET, linkTo: other, now: NOW }),
    )
    expect(conflict).toEqual({ kind: 'conflict' })
    const list = await run(storeId, (ctx) => listCustomerIdentities(ctx, me))
    expect(list.map((i) => i.provider)).toEqual(['facebook'])
    expect(
      await run(storeId, (ctx) => removeCustomerIdentity(ctx, other, list[0]?.id as string)),
    ).toBe(false)
    expect(
      await run(storeId, (ctx) => removeCustomerIdentity(ctx, me, list[0]?.id as string)),
    ).toBe(true)
  })

  it('erasing a customer removes their identities', async () => {
    const storeId = await makeStore()
    const r = await run(storeId, (ctx) =>
      resolveShopperIdentity(ctx, google(), { secret: SECRET, now: NOW }),
    )
    if (r.kind !== 'signed_in') throw new Error('expected sign-in')
    await run(storeId, (ctx) =>
      anonymiseCustomer(ctx, {
        customerId: r.customerId,
        actor: { type: 'staff', id: 'u1' },
        now: NOW,
      }),
    )
    expect(await owner.select().from(customerIdentity)).toHaveLength(0)
    const again = await run(storeId, (ctx) =>
      resolveShopperIdentity(ctx, google(), { secret: SECRET, now: NOW }),
    )
    expect(again).toMatchObject({ kind: 'signed_in', created: true })
  })
})

describe('magic link', () => {
  it('works once, for 15 minutes, and finds the same customer as the email code', async () => {
    const storeId = await makeStore()
    const existing = await makeCustomer(storeId, 'asha@example.com')
    const req = await run(storeId, (ctx) =>
      requestMagicLink(ctx, ' Asha@Example.com ', { nextPath: '/cart', remember: true }, NOW),
    )
    if (!req.ok) throw new Error('expected a link')
    expect(await run(storeId, (ctx) => magicLinkIsLive(ctx, req.token, NOW))).toBe(true)
    expect(await run(storeId, (ctx) => redeemMagicLink(ctx, req.token, NOW))).toEqual({
      ok: true,
      customerId: existing,
      nextPath: '/cart',
      remember: true,
    })
    expect(await run(storeId, (ctx) => redeemMagicLink(ctx, req.token, NOW))).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })

  it('refuses an expired link, a link from another store, and a resend inside 30 seconds', async () => {
    const storeId = await makeStore('a')
    const other = await makeStore('b')
    const req = await run(storeId, (ctx) =>
      requestMagicLink(ctx, 'asha@example.com', { nextPath: '/', remember: false }, NOW),
    )
    if (!req.ok) throw new Error('expected a link')
    expect(
      await run(storeId, (ctx) =>
        requestMagicLink(ctx, 'asha@example.com', { nextPath: '/', remember: false }, NOW),
      ),
    ).toEqual({ ok: false, reason: 'too_soon' })
    expect(await run(other, (ctx) => redeemMagicLink(ctx, req.token, NOW))).toEqual({
      ok: false,
      reason: 'invalid',
    })
    const later = new Date(NOW.getTime() + 16 * 60_000)
    expect(await run(storeId, (ctx) => redeemMagicLink(ctx, req.token, later))).toEqual({
      ok: false,
      reason: 'expired',
    })
    expect(
      await run(storeId, (ctx) =>
        requestMagicLink(ctx, 'not-an-email', { nextPath: '/', remember: false }, NOW),
      ),
    ).toEqual({ ok: false, reason: 'invalid_email' })
  })
})

describe('Truecaller', () => {
  const profileFetch = (body: unknown, ok = true) => {
    const calls: string[] = []
    return {
      calls,
      fetch: async (url: string) => {
        calls.push(url)
        return new Response(JSON.stringify(body), { status: ok ? 200 : 401 })
      },
    }
  }
  const random = Buffer.alloc(12, 3)

  it('signs in the customer with the verified number, once, for the browser holding the nonce', async () => {
    const storeId = await makeStore()
    const nonce = await run(storeId, (ctx) =>
      startTruecaller(ctx, { secret: SECRET, random, nextPath: '/account', remember: false }, NOW),
    )
    expect(await run(storeId, (ctx) => pollTruecaller(ctx, nonce, NOW))).toEqual({
      state: 'pending',
    })
    const f = profileFetch({ phoneNumbers: [919876543210], name: { first: 'Ravi', last: 'K' } })
    const done = await run(storeId, (ctx) =>
      completeTruecaller(
        ctx,
        {
          requestId: nonce,
          accessToken: 'tok',
          endpoint: 'https://profile4-noneu.truecaller.com/v1/default',
        },
        { secret: SECRET, fetch: f.fetch },
        NOW,
      ),
    )
    expect(done).toBe('ready')
    const polled = await run(storeId, (ctx) => pollTruecaller(ctx, nonce, NOW))
    expect(polled).toMatchObject({ state: 'ready', nextPath: '/account' })
    expect(await run(storeId, (ctx) => pollTruecaller(ctx, nonce, NOW))).toEqual({
      state: 'failed',
    })
    const [c] = await owner.select().from(customer).where(eq(customer.storeId, storeId))
    expect(decryptCustomerPhone(c?.phone ?? null, SECRET)).toBe('9876543210')
    expect(c?.email).toBeNull()
  })

  it('never fetches an endpoint outside truecaller.com, and ignores foreign nonces', async () => {
    const storeId = await makeStore('a')
    const other = await makeStore('b')
    const nonce = await run(storeId, (ctx) =>
      startTruecaller(ctx, { secret: SECRET, random, nextPath: '/', remember: false }, NOW),
    )
    const f = profileFetch({ phoneNumbers: [919876543210] })
    expect(
      await run(other, (ctx) =>
        completeTruecaller(
          ctx,
          { requestId: nonce, accessToken: 't', endpoint: 'https://x.truecaller.com/p' },
          { secret: SECRET, fetch: f.fetch },
          NOW,
        ),
      ),
    ).toBe('ignored')
    expect(
      await run(storeId, (ctx) =>
        completeTruecaller(
          ctx,
          { requestId: nonce, accessToken: 't', endpoint: 'http://169.254.169.254/' },
          { secret: SECRET, fetch: f.fetch },
          NOW,
        ),
      ),
    ).toBe('failed')
    expect(f.calls).toEqual([])
    expect(await run(storeId, (ctx) => pollTruecaller(ctx, nonce, NOW))).toEqual({
      state: 'failed',
    })
  })

  it('links the number to an existing phone customer', async () => {
    const storeId = await makeStore()
    // An existing phone-code customer.
    await run(storeId, async (ctx) => {
      const { requestPhoneLoginCode, verifyPhoneLoginCode } = await import('../accounts/otp')
      const r = await requestPhoneLoginCode(ctx, '9876543210', 'sms', NOW)
      if (!r.ok) throw new Error('code')
      await verifyPhoneLoginCode(ctx, '9876543210', r.code, SECRET, NOW)
    })
    const nonce = await run(storeId, (ctx) =>
      startTruecaller(ctx, { secret: SECRET, random, nextPath: '/', remember: false }, NOW),
    )
    const f = profileFetch({ phoneNumbers: ['+91 98765 43210'] })
    await run(storeId, (ctx) =>
      completeTruecaller(
        ctx,
        { requestId: nonce, accessToken: 't', endpoint: 'https://p.truecaller.com/x' },
        { secret: SECRET, fetch: f.fetch },
        NOW,
      ),
    )
    expect(await owner.select().from(customer).where(eq(customer.storeId, storeId))).toHaveLength(1)
    expect(await owner.select().from(customerLoginTicket)).toHaveLength(1)
  })
})

describe('merchant app credentials', () => {
  it('stores secrets encrypted, shows them masked, keeps a masked value on save', async () => {
    const storeId = await makeStore()
    await run(storeId, (ctx) =>
      saveOwnLoginApp(
        ctx,
        'google',
        { clientId: 'client-1', clientSecret: 'GOCSPX-supersecret' },
        SECRET,
      ),
    )
    const [row] = await owner.select({ lp: store.loginProviders }).from(store)
    expect(JSON.stringify(row?.lp)).not.toContain('supersecret')
    const masked = await run(storeId, (ctx) => maskedOwnLoginApps(ctx, SECRET))
    expect(masked.google).toEqual({ clientId: 'client-1', clientSecret: '••••cret' })
    await run(storeId, (ctx) =>
      saveOwnLoginApp(ctx, 'google', { clientId: 'client-2', clientSecret: '••••cret' }, SECRET),
    )
    const apps = await run(storeId, (ctx) => loadOwnLoginApps(ctx, SECRET))
    expect(apps.google).toEqual({
      provider: 'google',
      clientId: 'client-2',
      clientSecret: 'GOCSPX-supersecret',
    })
    await expect(
      run(storeId, (ctx) => saveOwnLoginApp(ctx, 'facebook', { appId: 'x' }, SECRET)),
    ).rejects.toBeInstanceOf(LoginAppIncomplete)
    await run(storeId, (ctx) => removeOwnLoginApp(ctx, 'google'))
    expect(await run(storeId, (ctx) => loadOwnLoginApps(ctx, SECRET))).toEqual({})
  })
})

describe('other sign-in pieces', () => {
  it('lists only live domains as return hosts', async () => {
    const storeId = await makeStore()
    const { storeDomain } = await import('@commerce/db')
    await owner.insert(storeDomain).values([
      { storeId, hostname: 'Waimers.waimers.store', status: 'active' },
      { storeId, hostname: 'shop.example.in', kind: 'custom', status: 'pending' },
    ])
    expect(await run(storeId, (ctx) => storeLoginHosts(ctx))).toEqual(['waimers.waimers.store'])
  })

  it('refuses a passkey answer without a valid challenge', async () => {
    const storeId = await makeStore()
    const px = { rpId: 'shop.example.in', origin: 'https://shop.example.in', secret: SECRET }
    const { challenge } = await passkeyLoginOptions(storeId, px, NOW)
    const other = await makeStore('b')
    const forged = {
      id: 'cred',
      rawId: 'cred',
      response: {},
      type: 'public-key',
      clientExtensionResults: {},
    }
    // Wrong store, wrong host, expired, and an unknown credential all fail closed.
    expect(
      await run(other, (ctx) =>
        verifyPasskeyLogin(ctx, { ...px, response: forged, challenge }, NOW),
      ),
    ).toEqual({ ok: false, reason: 'invalid' })
    expect(
      await run(storeId, (ctx) =>
        verifyPasskeyLogin(ctx, { ...px, rpId: 'evil.in', response: forged, challenge }, NOW),
      ),
    ).toEqual({ ok: false, reason: 'invalid' })
    expect(
      await run(storeId, (ctx) =>
        verifyPasskeyLogin(
          ctx,
          { ...px, response: forged, challenge },
          new Date(NOW.getTime() + 6 * 60_000),
        ),
      ),
    ).toEqual({ ok: false, reason: 'invalid' })
    expect(
      await run(storeId, (ctx) =>
        verifyPasskeyLogin(ctx, { ...px, response: forged, challenge }, NOW),
      ),
    ).toEqual({ ok: false, reason: 'invalid' })
    const someone = await makeCustomer(storeId)
    expect(await run(storeId, (ctx) => listCustomerPasskeys(ctx, someone))).toEqual([])
  })

  it('an email code session can be shorter ("Remember this device" unticked)', async () => {
    const storeId = await makeStore()
    const { requestLoginCode } = await import('../accounts/auth')
    const r = await run(storeId, (ctx) => requestLoginCode(ctx, 'asha@example.com', NOW))
    if (!r.ok) throw new Error('code')
    const s = await run(storeId, (ctx) =>
      verifyLoginCode(ctx, r.email, r.code, NOW, 12 * 3_600_000),
    )
    expect(s.ok && s.expiresAt.getTime() - NOW.getTime()).toBe(12 * 3_600_000)
  })
})

describe('saving the settings', () => {
  it('refuses a provider switched on without an app', async () => {
    const { saveCustomerAccountSettings, LoginProviderNeedsSetup } = await import(
      '../customer-accounts/service'
    )
    const storeId = await makeStore()
    const none = {
      google: { platform: false, own: false },
      apple: { platform: false, own: false },
      facebook: { platform: false, own: false },
      truecaller: { platform: false, own: false },
    }
    const input = { loginMethods: ['email'], providers: { google: { enabled: true } } }
    await expect(
      run(storeId, (ctx) => saveCustomerAccountSettings(ctx, input, ['email'], none)),
    ).rejects.toBeInstanceOf(LoginProviderNeedsSetup)
    const saved = await run(storeId, (ctx) =>
      saveCustomerAccountSettings(ctx, input, ['email'], {
        ...none,
        google: { platform: true, own: false },
      }),
    )
    expect(saved.providers.google).toEqual({ enabled: true, credentials: 'platform' })
  })
})
