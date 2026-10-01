/** SOURCE OF TRUTH: merchant signup gate tests — open/invite modes, single-use and expiring invites */
import { createDb, signupWaitlist } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { checkSignupGate, consumeSignupInvite, createSignupInvite } from './signup-gate'
import { joinSignupWaitlist } from './waitlist'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

/** The live invite the gate would use for this email in invite mode, if any. */
const findLiveSignupInvite = async (db: typeof app, email: string) => {
  const decision = await checkSignupGate(db, { email, mode: 'invite', ownsAStoreAlready: false })
  return decision.allowed ? decision.invite : null
}

describe('checkSignupGate', () => {
  it('allows anyone in open mode', async () => {
    const decision = await checkSignupGate(app, {
      email: 'nobody@example.com',
      mode: 'open',
      ownsAStoreAlready: false,
    })
    expect(decision.allowed).toBe(true)
  })

  it('allows a merchant who already owns a store, even with no invite, in invite mode', async () => {
    const decision = await checkSignupGate(app, {
      email: 'owner@example.com',
      mode: 'invite',
      ownsAStoreAlready: true,
    })
    expect(decision.allowed).toBe(true)
  })

  it('refuses a first-time signup with no invite in invite mode', async () => {
    const decision = await checkSignupGate(app, {
      email: 'nobody@example.com',
      mode: 'invite',
      ownsAStoreAlready: false,
    })
    expect(decision.allowed).toBe(false)
  })

  it('allows a first-time signup with a live invite', async () => {
    await createSignupInvite(app, 'invited@example.com')
    const decision = await checkSignupGate(app, {
      email: 'Invited@Example.com',
      mode: 'invite',
      ownsAStoreAlready: false,
    })
    expect(decision.allowed).toBe(true)
    if (decision.allowed) expect(decision.invite?.email).toBe('invited@example.com')
  })
})

describe('signup invites', () => {
  it('is single-use: an invite stops being live once consumed', async () => {
    const invite = await createSignupInvite(app, 'once@example.com')
    expect(await findLiveSignupInvite(app, 'once@example.com')).not.toBeNull()

    expect(await consumeSignupInvite(app, invite.id)).toBe(true)
    expect(await findLiveSignupInvite(app, 'once@example.com')).toBeNull()
    // A second, parallel "Create store" cannot ride the same invite.
    expect(await consumeSignupInvite(app, invite.id)).toBe(false)
  })

  it('inviting the same email again cancels the older invite', async () => {
    const first = await createSignupInvite(app, 'twice@example.com')
    const second = await createSignupInvite(app, 'twice@example.com')

    expect(second.id).not.toBe(first.id)
    const live = await findLiveSignupInvite(app, 'twice@example.com')
    expect(live?.id).toBe(second.id)
  })

  it('an expired invite is not live', async () => {
    await createSignupInvite(app, 'stale@example.com', { expiresInMs: -1000 })
    expect(await findLiveSignupInvite(app, 'stale@example.com')).toBeNull()
  })
})

describe('signup waitlist', () => {
  it('joining twice updates the entry, and an invite marks it invited', async () => {
    const entry = { email: 'Wait@Example.com', phone: '98765 43210', sells: 'Tea' }
    await joinSignupWaitlist(app, entry, { userId: 'usr_wait' })
    await joinSignupWaitlist(app, { ...entry, sells: 'Tea and spices' })

    const rows = await app.select().from(signupWaitlist)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      email: 'wait@example.com',
      sells: 'Tea and spices',
      userId: 'usr_wait',
      invitedAt: null,
    })

    await createSignupInvite(app, 'wait@example.com')
    const [invited] = await app
      .select()
      .from(signupWaitlist)
      .where(eq(signupWaitlist.email, 'wait@example.com'))
    expect(invited?.invitedAt).toBeInstanceOf(Date)
  })
})
