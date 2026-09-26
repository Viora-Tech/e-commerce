import { createDb } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  checkSignupGate,
  consumeSignupInvite,
  createSignupInvite,
  findLiveSignupInvite,
} from './signup-gate'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

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

    await consumeSignupInvite(app, invite.id)
    expect(await findLiveSignupInvite(app, 'once@example.com')).toBeNull()
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
