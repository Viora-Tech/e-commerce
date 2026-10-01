/** SOURCE OF TRUTH: passkey challenge tests (security audit D-04) — challenges kept server-side, single use, five minutes, bound to the registering customer and the rpID, user verification required */
import {
  createDb,
  customer,
  customerLoginTicket,
  customerPasskey,
  type StoreTx,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * The browser's signature is the library's job (and needs a real authenticator), so its two
 * verify calls are stubbed: they report success and record what they were asked to expect.
 * Everything about the challenge (where it lives, single use, expiry, binding) is ours.
 */
const verifyCalls: { expectedChallenge: string; requireUserVerification?: boolean }[] = []
vi.mock('@simplewebauthn/server', async (importActual) => {
  const actual = await importActual<typeof import('@simplewebauthn/server')>()
  return {
    ...actual,
    verifyAuthenticationResponse: vi.fn(async (opts: (typeof verifyCalls)[number]) => {
      verifyCalls.push(opts)
      return { verified: true, authenticationInfo: { newCounter: 1 } }
    }),
    verifyRegistrationResponse: vi.fn(async (opts: (typeof verifyCalls)[number]) => {
      verifyCalls.push(opts)
      return {
        verified: true,
        registrationInfo: {
          credential: { id: 'cred-new', publicKey: new Uint8Array([1, 2, 3]), counter: 0 },
          credentialDeviceType: 'multiDevice',
          credentialBackedUp: true,
        },
      }
    }),
  }
})

const {
  passkeyLoginOptions,
  passkeyRegistrationOptions,
  verifyPasskeyLogin,
  verifyPasskeyRegistration,
} = await import('./passkeys')

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const NOW = new Date('2026-10-01T10:00:00Z')
const PX = { rpId: 'shop.example.in', origin: 'https://shop.example.in' }
const ANSWER = { id: 'cred-1', rawId: 'cred-1', response: {}, type: 'public-key' }

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  verifyCalls.length = 0
  await resetDb(owner)
})

const run = <T>(storeId: string, fn: (ctx: { storeId: string; tx: StoreTx }) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

async function storeWithPasskey() {
  const [s] = await owner.insert(store).values({ slug: 'waimers', name: 'Waimers' }).returning()
  const storeId = s?.id as string
  const [c] = await owner.insert(customer).values({ storeId, email: 'asha@example.com' }).returning()
  const customerId = c?.id as string
  await owner.insert(customerPasskey).values({
    storeId,
    customerId,
    credentialId: 'cred-1',
    publicKey: Buffer.from([9, 9, 9]).toString('base64url'),
    rpId: PX.rpId,
    deviceType: 'multiDevice',
  })
  return { storeId, customerId }
}

describe('passkey sign-in challenges', () => {
  it('asks for user verification and keeps the challenge on the server, not in the cookie', async () => {
    const { storeId } = await storeWithPasskey()
    const { options, challenge } = await run(storeId, (ctx) => passkeyLoginOptions(ctx, PX, NOW))
    expect(options.userVerification).toBe('required')
    expect(challenge).not.toContain(options.challenge)
    const [row] = await owner.select().from(customerLoginTicket)
    expect(row).toMatchObject({ kind: 'passkey_login', challenge: options.challenge, returnUrl: PX.rpId })
    expect(row?.tokenHash).not.toBe(challenge)
  })

  it('signs in once with the stored challenge; the same cookie never works twice', async () => {
    const { storeId, customerId } = await storeWithPasskey()
    const { options, challenge } = await run(storeId, (ctx) => passkeyLoginOptions(ctx, PX, NOW))
    const answer = () =>
      run(storeId, (ctx) => verifyPasskeyLogin(ctx, { ...PX, response: ANSWER, challenge }, NOW))
    expect(await answer()).toEqual({ ok: true, customerId })
    expect(verifyCalls[0]).toMatchObject({
      expectedChallenge: options.challenge,
      requireUserVerification: true,
    })
    expect(await answer()).toEqual({ ok: false, reason: 'invalid' })
    expect(await owner.select().from(customerLoginTicket)).toHaveLength(0)
  })

  it('refuses an expired challenge, another rpID, and a made-up cookie', async () => {
    const { storeId } = await storeWithPasskey()
    const issue = async () =>
      (await run(storeId, (ctx) => passkeyLoginOptions(ctx, PX, NOW))).challenge
    const late = await issue()
    expect(
      await run(storeId, (ctx) =>
        verifyPasskeyLogin(
          ctx,
          { ...PX, response: ANSWER, challenge: late },
          new Date(NOW.getTime() + 5 * 60_000 + 1),
        ),
      ),
    ).toEqual({ ok: false, reason: 'invalid' })
    const host = await issue()
    expect(
      await run(storeId, (ctx) =>
        verifyPasskeyLogin(ctx, { ...PX, rpId: 'evil.in', response: ANSWER, challenge: host }, NOW),
      ),
    ).toEqual({ ok: false, reason: 'invalid' })
    expect(
      await run(storeId, (ctx) =>
        verifyPasskeyLogin(ctx, { ...PX, response: ANSWER, challenge: 'x'.repeat(43) }, NOW),
      ),
    ).toEqual({ ok: false, reason: 'invalid' })
    expect(verifyCalls).toHaveLength(0)
  })
})

describe('adding a passkey', () => {
  it('binds the challenge to the signed-in customer and requires user verification', async () => {
    const { storeId, customerId } = await storeWithPasskey()
    const [c2] = await owner
      .insert(customer)
      .values({ storeId, email: 'ravi@example.com' })
      .returning()
    const other = c2?.id as string
    const issued = await run(storeId, (ctx) =>
      passkeyRegistrationOptions(ctx, customerId, { ...PX, storeName: 'Waimers' }, NOW),
    )
    expect(issued?.options.authenticatorSelection?.userVerification).toBe('required')
    // Another customer cannot finish this ceremony, and trying spends it.
    expect(
      await run(storeId, (ctx) =>
        verifyPasskeyRegistration(
          ctx,
          other,
          { ...PX, response: ANSWER, challenge: issued?.challenge },
          NOW,
        ),
      ),
    ).toEqual({ ok: false, reason: 'invalid' })
    const again = await run(storeId, (ctx) =>
      passkeyRegistrationOptions(ctx, customerId, { ...PX, storeName: 'Waimers' }, NOW),
    )
    expect(
      await run(storeId, (ctx) =>
        verifyPasskeyRegistration(
          ctx,
          customerId,
          { ...PX, response: ANSWER, challenge: again?.challenge },
          NOW,
        ),
      ),
    ).toEqual({ ok: true })
    expect(verifyCalls.at(-1)).toMatchObject({
      expectedChallenge: again?.options.challenge,
      requireUserVerification: true,
    })
    expect(await owner.select().from(customerPasskey)).toHaveLength(2)
  })
})
